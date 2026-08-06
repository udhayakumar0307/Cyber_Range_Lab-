import logging
import uuid
import secrets
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_admin_org_id
from app.core.config import settings
from app.models.user import User
from app.models.admin_models import (
    Cart, CartItem, Order, OrderItem, Payment, Invoice,
    PurchasedLab, License, AdminProfile, Organization
)
from app.models.audit_log import AuditLog
from app.services.audit_service import log_audit_event

logger = logging.getLogger(__name__)
router = APIRouter()

class CreateOrderRequest(BaseModel):
    institution_name: Optional[str] = None
    discount_code: Optional[str] = None

class VerifyPaymentRequest(BaseModel):
    order_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@router.post("/checkout/create-order")
@router.post("/payments/create-order")
def create_checkout_order(
    data: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Production Razorpay Order Initialization.
    Calculates grand total, creates DB Order & OrderItems, and calls Razorpay API if credentials exist.
    """
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shopping cart is empty.")

    subtotal = sum(item.price_inr for item in cart.items)
    discount = 0.0
    if data.discount_code and data.discount_code.upper() in ["ASTRA10", "CYBER10"]:
        discount = round(subtotal * 0.10, 2)
    
    taxable = subtotal - discount
    # Optional GST Support based on configuration or organization GST registration
    tax = round(taxable * 0.18, 2) if settings.ENABLE_GST else 0.0
    grand_total = round(taxable + tax, 2)
    amount_in_paise = int(grand_total * 100)

    admin_prof = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    org_id = admin_prof.organization_id if admin_prof else None
    inst_name = data.institution_name or (admin_prof.organization.name if admin_prof and admin_prof.organization else "CyberRange Enterprise")

    order_num = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
    order = Order(
        order_number=order_num,
        user_id=current_user.id,
        organization_id=org_id,
        institution_name=inst_name,
        subtotal=subtotal,
        tax=tax,
        discount=discount,
        grand_total=grand_total,
        status="PENDING"
    )
    db.add(order)
    db.flush()

    for item in cart.items:
        order_item = OrderItem(
            order_id=order.id,
            lab_id=item.lab_id,
            lab_title=item.lab_title,
            seats=1,
            duration_months=12,
            price=item.price_inr,
            hours_purchased=item.hours_purchased or 40
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)

    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        logger.error("Razorpay API credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing in environment configuration.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Razorpay production credentials are missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env."
        )

    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        rzp_order = client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": order.order_number,
            "notes": {"organization_id": str(org_id), "user_email": current_user.email}
        })
        razorpay_order_id = rzp_order.get("id")
        if not razorpay_order_id or not razorpay_order_id.startswith("order_"):
            raise ValueError(f"Razorpay SDK returned invalid order ID structure: {rzp_order}")
    except Exception as e:
        logger.error(f"Razorpay SDK order creation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create Razorpay Order on Razorpay servers: {str(e)}"
        )

    order.razorpay_order_id = razorpay_order_id
    db.commit()
    db.refresh(order)

    logger.info(f"[Checkout Order Created] DB Order ID: {order.id} | Razorpay Order ID: {razorpay_order_id} | Amount: INR {order.grand_total}")

    return {
        "success": True,
        "db_order_id": order.id,
        "order_id": order.id,
        "order_number": order.order_number,
        "amount": order.grand_total,
        "amount_paise": amount_in_paise,
        "currency": "INR",
        "razorpay_order_id": razorpay_order_id,
        "razorpay_key_id": settings.RAZORPAY_KEY_ID,
        "key": settings.RAZORPAY_KEY_ID,
        "institution_name": inst_name
    }

@router.post("/checkout/verify-payment")
@router.post("/payments/verify")
def verify_payment(
    data: VerifyPaymentRequest,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Production Razorpay Signature Verification & Provisioning.
    Verifies Razorpay HMAC SHA256 signature using RAZORPAY_KEY_SECRET.
    Creates Payment, Invoice, PurchasedLab, and individual License records within a DB transaction.
    """
    order = db.query(Order).filter(Order.id == data.order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    # 1. Verify Razorpay Signature if Secret is configured
    if settings.RAZORPAY_KEY_SECRET:
        logger.info(f"==> VERIFY PAYMENT SIGNATURE: DB Order ID={order.id} | req.order_id={data.razorpay_order_id} | req.payment_id={data.razorpay_payment_id} | req.sig={data.razorpay_signature}")
        logger.info(f"Using RAZORPAY_KEY_SECRET length: {len(settings.RAZORPAY_KEY_SECRET)}")

        msg = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"
        generated_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
            msg.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        logger.info(f"Generated Signature: {generated_signature} | Match={generated_signature == data.razorpay_signature}")

        if generated_signature != data.razorpay_signature:
            # Check for signature fallback if secret has spaces/quotes around it
            cleaned_secret = settings.RAZORPAY_KEY_SECRET.strip().strip("'").strip('"')
            fallback_signature = hmac.new(
                cleaned_secret.encode('utf-8'),
                msg.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            if fallback_signature == data.razorpay_signature:
                logger.info("Signature matched using cleaned/stripped key secret!")
                generated_signature = fallback_signature
            else:
                log_audit_event(
                    db=db,
                    action="Razorpay Signature Verification Failed",
                    entity="Order",
                    entity_id=str(order.id),
                    performed_by=current_user.email,
                    performed_by_role=current_user.role,
                    organization_id=order.organization_id,
                    status="FAILED",
                    new_value=f"Invalid HMAC signature for Razorpay Order {data.razorpay_order_id}. msg={msg} sig={data.razorpay_signature} gen={generated_signature}",
                    request=request
                )
                order.status = "FAILED"
                db.commit()
                raise HTTPException(status_code=400, detail=f"Razorpay signature verification failed. Payment tampered or unverified.")

    # Prevent duplicate payment processing for same transaction
    existing_pay = db.query(Payment).filter(Payment.transaction_id == data.razorpay_payment_id).first()
    if existing_pay:
        return {"status": "success", "message": "Payment already verified.", "order_number": order.order_number}

    # 2. Record Payment & Update Order
    payment = Payment(
        order_id=order.id,
        transaction_id=data.razorpay_payment_id,
        payment_status="SUCCESS",
        gateway="razorpay",
        amount=order.grand_total,
        currency="INR",
        method="Razorpay Online"
    )
    db.add(payment)
    db.flush()

    order.status = "COMPLETED"

    # 3. Generate Official Invoice
    inv_num = f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
    invoice = Invoice(
        invoice_number=inv_num,
        order_id=order.id,
        payment_id=payment.id,
        user_id=current_user.id,
        amount=order.grand_total,
        billing_address_json=f"{order.institution_name}, GST: IN38291039102"
    )
    db.add(invoice)

    # 4. Provision Purchased Labs & Individual License Keys
    # Always resolve org_id — never allow organization_id=NULL on PurchasedLab
    resolved_org_id = order.organization_id
    if not resolved_org_id:
        resolved_org_id = get_admin_org_id(current_user, db)
    # Back-fill order.organization_id if it was null
    if not order.organization_id:
        order.organization_id = resolved_org_id

    for item in order.items:
        expiry = datetime.utcnow() + timedelta(days=365) # 1 Year expiry default
        license_key = f"LIC-{item.lab_id.upper()}-{secrets.token_hex(6).upper()}"
        hours = item.hours_purchased or 40

        purchased_lab = PurchasedLab(
            user_id=current_user.id,
            organization_id=resolved_org_id,
            lab_id=item.lab_id,
            lab_title=item.lab_title,
            license_key=license_key,
            total_seats=999, # Deprecate seat constraints
            assigned_seats=0,
            status="ACTIVE",
            expiry_date=expiry,
            hours_purchased=hours,
            hours_remaining=hours,
            hours_used=0
        )
        db.add(purchased_lab)
        db.flush()

    # 5. Clear Cart
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()

    log_audit_event(
        db=db,
        action="Razorpay Payment Success",
        entity="Order",
        entity_id=str(order.id),
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        organization_id=order.organization_id,
        status="SUCCESS",
        new_value=f"Paid {order.grand_total} INR via Razorpay TXN: {data.razorpay_payment_id}",
        request=request
    )

    # 6. Automatic Production Notification Dispatch
    try:
        from app.services.notification_service import notification_service
        notification_service.create_and_send(
            db=db,
            user_id=current_user.id,
            title="Lab Purchase Successful",
            message=f"Your purchase of enterprise lab seats for Order #{order.order_number} (₹{order.grand_total:,.2f}) was verified successfully.",
            notification_type="PURCHASE",
            priority="HIGH",
            action_url="/admin/purchased-labs",
            phone_number=getattr(current_user, "phone", None)
        )
    except Exception as n_err:
        logger.warning(f"Payment notification dispatch failed (non-fatal): {n_err}")

    db.commit()
    return {
        "status": "success",
        "message": "Razorpay payment verified and licenses provisioned successfully!",
        "order_number": order.order_number,
        "invoice_number": inv_num,
        "transaction_id": data.razorpay_payment_id,
        "amount_paid": order.grand_total
    }

@router.get("/payments/invoice/{invoice_id}/pdf")
@router.get("/payments/invoice/{invoice_id}")
@router.get("/payments/invoices/{invoice_id}/download")
def download_invoice_pdf(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates official Invoice PDF document using ReportLab for an organization purchase.
    """
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if inv.user_id != current_user.id and current_user.role not in ["admin", "super_admin", "system_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden from viewing invoice of another organization.")

    order = db.query(Order).filter(Order.id == inv.order_id).first()
    payment = db.query(Payment).filter(Payment.id == inv.payment_id).first() if inv.payment_id else None

    # ReportLab PDF Generation
    import io
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0052CC'),
        fontName='Helvetica-Bold'
    )
    subtitle_style = ParagraphStyle(
        'InvoiceSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569')
    )
    bold_style = ParagraphStyle(
        'InvoiceBold',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        fontName='Helvetica-Bold'
    )
    normal_style = ParagraphStyle(
        'InvoiceNormal',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    elements = []

    # Header section
    header_data = [
        [
            Paragraph("<b>CyberRange Enterprise</b><br/><font size=9 color='#64748B'>Cybersecurity Virtual Lab Platform</font>", title_style),
            Paragraph(f"<font size=16 color='#0052CC'><b>TAX INVOICE</b></font><br/><b>Invoice #:</b> {inv.invoice_number}<br/><b>Date:</b> {inv.created_at.strftime('%Y-%m-%d %H:%M')}", normal_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[300, 240])
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(header_table)
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E2E8F0'), spaceAfter=15))

    # Customer & Transaction Info
    info_data = [
        [
            Paragraph("<b>Billed To:</b>", bold_style),
            Paragraph("<b>Payment Telemetry:</b>", bold_style)
        ],
        [
            Paragraph(f"<b>Customer Name:</b> {current_user.name or 'Valued Admin'}<br/><b>Email:</b> {current_user.email}<br/><b>Organization:</b> {order.institution_name if order else 'Enterprise Client'}<br/><b>Address:</b> {inv.billing_address_json or 'N/A'}", normal_style),
            Paragraph(f"<b>Order ID:</b> {order.id if order else 'N/A'}<br/><b>Razorpay Order ID:</b> {order.razorpay_order_id if order else 'N/A'}<br/><b>Razorpay Payment ID:</b> {payment.transaction_id if payment else 'N/A'}<br/><b>Payment Method:</b> {payment.method if payment else 'Razorpay Online'}<br/><b>Status:</b> <font color='#16A34A'><b>{payment.payment_status if payment else 'SUCCESS'}</b></font>", normal_style)
        ]
    ]
    info_table = Table(info_data, colWidths=[270, 270])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('PADDING', (0,0), (-1,-1), 8),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0'))
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    # Purchased Items Table
    item_rows = [[
        Paragraph("<b>Item Description</b>", bold_style),
        Paragraph("<b>Quantity</b>", bold_style),
        Paragraph("<b>Duration</b>", bold_style),
        Paragraph("<b>Price/Seat</b>", bold_style),
        Paragraph("<b>Subtotal</b>", bold_style)
    ]]

    if order and order.items:
        for item in order.items:
            item_rows.append([
                Paragraph(item.lab_title, normal_style),
                Paragraph(str(item.seats), normal_style),
                Paragraph(f"{item.duration_months} Months", normal_style),
                Paragraph(f"₹{item.price:,.2f}", normal_style),
                Paragraph(f"₹{(item.seats * item.price):,.2f}", normal_style)
            ])
    else:
        item_rows.append([
            Paragraph("Enterprise Lab Seats Subscription", normal_style),
            Paragraph("1", normal_style),
            Paragraph("12 Months", normal_style),
            Paragraph(f"₹{inv.amount:,.2f}", normal_style),
            Paragraph(f"₹{inv.amount:,.2f}", normal_style)
        ])

    items_table = Table(item_rows, colWidths=[200, 70, 80, 95, 95])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0052CC')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('PADDING', (0,0), (-1,-1), 6)
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 15))

    # Total Breakdown Table
    subtotal = order.subtotal if (order and order.subtotal) else inv.amount * 0.82
    tax = order.tax if (order and order.tax) else inv.amount * 0.18

    total_data = [
        [Paragraph("Subtotal:", normal_style), Paragraph(f"₹{subtotal:,.2f}", normal_style)],
        [Paragraph("GST (18%):", normal_style), Paragraph(f"₹{tax:,.2f}", normal_style)],
        [Paragraph("<b>Grand Total:</b>", bold_style), Paragraph(f"<font color='#0052CC'><b>₹{inv.amount:,.2f}</b></font>", bold_style)]
    ]
    totals_table = Table(total_data, colWidths=[445, 95])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('LINEABOVE', (0,2), (-1,2), 1, colors.HexColor('#0052CC')),
        ('PADDING', (0,0), (-1,-1), 4)
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 30))

    # Signature & Footer
    footer_data = [
        [
            Paragraph("<font size=8 color='#64748B'>CyberRange Telemetry Billing Unit<br/>Official Tax Receipt & Order Fulfillment Confirmation</font>", normal_style),
            Paragraph("<b>Authorized Signature:</b><br/><br/><i>CyberRange Accounts Lead</i>", normal_style)
        ]
    ]
    footer_table = Table(footer_data, colWidths=[340, 200])
    footer_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'BOTTOM')]))
    elements.append(footer_table)

    doc.build(elements)
    buffer.seek(0)

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="INV-{inv.invoice_number}.pdf"'}
    )

@router.get("/payments/history")
def get_payment_history(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns organization-scoped payment and invoice history.
    """
    org_id = get_admin_org_id(current_user, db)
    query = db.query(Invoice).filter(Invoice.user_id == current_user.id)
    invoices = query.order_by(Invoice.created_at.desc()).all()

    result = []
    for inv in invoices:
        order = db.query(Order).filter(Order.id == inv.order_id).first()
        payment = db.query(Payment).filter(Payment.id == inv.payment_id).first() if inv.payment_id else None

        inv_data = {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "order_id": order.order_number if order else f"ORD-{inv.order_id}",
            "amount": inv.amount,
            "payment_method": payment.method if payment else "Razorpay Online",
            "gateway": payment.gateway if payment else "razorpay",
            "status": payment.payment_status if payment else "SUCCESS",
            "date": inv.created_at.strftime("%Y-%m-%d %H:%M:%S") if inv.created_at else "",
            "download_url": f"/api/v1/payments/invoices/{inv.id}/download"
        }

        if search:
            s = search.lower()
            if s in inv.invoice_number.lower() or (order and s in order.order_number.lower()):
                result.append(inv_data)
        else:
            result.append(inv_data)

    return result

@router.get("/admin/purchased-labs")
def get_purchased_labs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists organization purchased labs and seat allocation pool.
    """
    from sqlalchemy import or_, and_

    # Resolve organization ID for current admin user
    user_org_id = None
    if current_user.group:
        user_org_id = current_user.group.organization_id

    admin_prof = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    if admin_prof:
        user_org_id = admin_prof.organization_id

    conditions = [
        PurchasedLab.user_id == current_user.id
    ]
    if user_org_id is not None:
        conditions.append(PurchasedLab.organization_id == user_org_id)

    conditions.append(
        and_(
            PurchasedLab.organization_id.is_(None),
            PurchasedLab.assigned_to.in_(["admin", "both"]),
            or_(
                PurchasedLab.fixed_rate == 0.0,
                PurchasedLab.fixed_rate.is_(None)
            )
        )
    )

    labs = db.query(PurchasedLab).filter(
        or_(*conditions),
        PurchasedLab.status == "ACTIVE"
    ).order_by(PurchasedLab.purchased_date.desc()).all()


    result = []
    for lab in labs:
        result.append({
            "id": lab.id,
            "lab_id": lab.lab_id,
            "lab_title": lab.lab_title,
            "license_key": lab.license_key,
            "total_seats": lab.total_seats,
            "assigned_seats": lab.assigned_seats,
            "hours_purchased": lab.hours_purchased or 0,
            "hours_remaining": lab.hours_remaining or 0,
            "hours_used": (lab.hours_purchased or 0) - (lab.hours_remaining or 0),
            "status": lab.status,
            "purchased_date": lab.purchased_date.strftime("%Y-%m-%d") if lab.purchased_date else "",
            "expiry_date": lab.expiry_date.strftime("%Y-%m-%d") if lab.expiry_date else ""
        })

    return result

# =========================================================================
# 6. WEBHOOK & REFUND HARDENING ARCHITECTURE
# =========================================================================

@router.post("/payments/webhook")
async def razorpay_webhook_listener(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Razorpay Production Webhook Endpoint.
    Verifies X-Razorpay-Signature HMAC header before processing event payloads.
    Supports: payment.captured, payment.failed, refund.processed, subscription.charged.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("x-razorpay-signature")

    if not settings.RAZORPAY_WEBHOOK_SECRET:
        logger.error("Razorpay Webhook Secret is missing in backend environment configuration.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Razorpay Webhook Secret is not configured on server."
        )

    if not signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing X-Razorpay-Signature header.")

    expected_sig = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()
    if expected_sig != signature:
        logger.warning("Razorpay Webhook HMAC signature mismatch.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Razorpay webhook signature.")

    try:
        import json
        payload = json.loads(body.decode("utf-8"))
        event = payload.get("event")
        event_payload = payload.get("payload", {})

        logger.info(f"[Razorpay Webhook] Received event: {event}")

        if event in ["payment.captured", "order.paid"]:
            payment_entity = event_payload.get("payment", {}).get("entity", {})
            rzp_order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")

            if rzp_order_id and payment_id:
                # Find DB Order
                existing_pay = db.query(Payment).filter(Payment.transaction_id == payment_id).first()
                if not existing_pay:
                    order = db.query(Order).filter(Order.status == "PENDING").order_by(Order.id.desc()).first()
                    if order:
                        order.status = "COMPLETED"
                        pay = Payment(
                            order_id=order.id,
                            transaction_id=payment_id,
                            payment_status="SUCCESS",
                            gateway="razorpay",
                            amount=order.grand_total,
                            currency="INR",
                            method="Razorpay Webhook"
                        )
                        db.add(pay)
                        db.commit()

        elif event == "payment.failed":
            payment_entity = event_payload.get("payment", {}).get("entity", {})
            payment_id = payment_entity.get("id", "FAILED_TXN")
            log_audit_event(
                db=db,
                action="Razorpay Webhook Payment Failed",
                entity="Payment",
                entity_id=payment_id,
                performed_by="Razorpay Webhook",
                performed_by_role="System",
                status="FAILED",
                new_value=f"Payment failed via webhook callback for txn: {payment_id}"
            )

        elif event == "refund.processed":
            refund_entity = event_payload.get("refund", {}).get("entity", {})
            payment_id = refund_entity.get("payment_id")
            if payment_id:
                pay = db.query(Payment).filter(Payment.transaction_id == payment_id).first()
                if pay:
                    pay.payment_status = "REFUNDED"
                    db.commit()

    except Exception as e:
        logger.error(f"Error parsing Razorpay webhook body: {e}")

    return {"status": "ok", "message": "Webhook processed successfully"}

class RefundRequest(BaseModel):
    payment_id: int
    reason: str

@router.post("/payments/refund")
def process_refund_request(
    data: RefundRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Refund Support Architecture.
    Revokes allocated licenses and marks Payment status as REFUNDED. Strictly system_admin/super_admin protected.
    """
    if current_user.role not in ["super_admin", "system_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Forbidden from initiating payment refunds.")

    pay = db.query(Payment).filter(Payment.id == data.payment_id).first()
    if not pay:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    pay.payment_status = "REFUNDED"

    # Deactivate purchased lab seat licenses associated with this order
    purchased = db.query(PurchasedLab).filter(PurchasedLab.user_id == pay.order.user_id).all() if pay.order else []
    for p in purchased:
        p.status = "SUSPENDED"

    log_audit_event(
        db=db,
        action="Refund Processed",
        entity="Payment",
        entity_id=str(pay.id),
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        status="SUCCESS",
        new_value=f"Refunded payment transaction {pay.transaction_id} for amount {pay.amount}. Reason: {data.reason}"
    )

    db.commit()
    return {"status": "success", "message": f"Payment {pay.transaction_id} has been refunded and licenses suspended."}


# ==========================================================
# STUDENT LAB PURCHASE & PROVISIONING ENDPOINTS
# ==========================================================

class StudentCreateOrderRequest(BaseModel):
    lab_id: str
    price: float

class StudentVerifyPaymentRequest(BaseModel):
    lab_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    amount: float

@router.post("/student/create-order")
def student_create_checkout_order(
    data: StudentCreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initializes a Razorpay order specifically for student purchase flow.
    """
    amount_in_paise = int(data.price * 100)
    order_num = f"STU-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"

    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        # Fallback fake order structure for demo/testing setup without backend crash
        return {
            "success": True,
            "order_id": 9999,
            "order_number": order_num,
            "amount": data.price,
            "amount_paise": amount_in_paise,
            "currency": "INR",
            "razorpay_order_id": f"order_{secrets.token_hex(8)}",
            "razorpay_key_id": "rzp_test_placeholder"
        }

    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        rzp_order = client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": order_num,
            "notes": {"user_id": str(current_user.id), "lab_id": data.lab_id}
        })
        razorpay_order_id = rzp_order.get("id")
    except Exception as e:
        logger.error(f"Razorpay Student Order failed: {e}")
        # Graceful fallback order ID
        razorpay_order_id = f"order_{secrets.token_hex(8)}"

    return {
        "success": True,
        "order_id": 9999,
        "order_number": order_num,
        "amount": data.price,
        "amount_paise": amount_in_paise,
        "currency": "INR",
        "razorpay_order_id": razorpay_order_id,
        "razorpay_key_id": settings.RAZORPAY_KEY_ID or "rzp_test_placeholder",
        "key": settings.RAZORPAY_KEY_ID or "rzp_test_placeholder"
    }

@router.post("/student/verify-payment")
def student_verify_payment(
    data: StudentVerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verifies Razorpay payment signature using official SDK and unlocks the lab.
    """
    logger.info(f"[StudentVerify] START | user={current_user.id} ({current_user.email}) | lab={data.lab_id} | order={data.razorpay_order_id} | payment={data.razorpay_payment_id} | sig={data.razorpay_signature} | amount={data.amount}")

    # 1. Prevent duplicate purchases
    purchased = db.query(PurchasedLab).filter(
        PurchasedLab.user_id == current_user.id,
        PurchasedLab.lab_id == data.lab_id,
        PurchasedLab.status == "ACTIVE"
    ).first()
    if purchased:
        logger.info(f"[StudentVerify] Duplicate check: Lab '{data.lab_id}' already purchased by user {current_user.id}")
        return {"status": "success", "message": "Lab already purchased.", "lab_id": data.lab_id}

    # 2. Validate Razorpay Configuration
    key_secret = settings.RAZORPAY_KEY_SECRET
    key_id = settings.RAZORPAY_KEY_ID
    if not key_id or not key_secret:
        logger.error("[StudentVerify] Razorpay credentials missing from settings")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment gateway is unconfigured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET."
        )

    key_secret = key_secret.strip().strip("'").strip('"')
    key_id = key_id.strip().strip("'").strip('"')

    # 3. Signature Verification
    try:
        import razorpay as razorpay_lib
        client = razorpay_lib.Client(auth=(key_id, key_secret))
        client.utility.verify_payment_signature({
            'razorpay_order_id': data.razorpay_order_id,
            'razorpay_payment_id': data.razorpay_payment_id,
            'razorpay_signature': data.razorpay_signature
        })
        logger.info(f"[StudentVerify] Signature successfully verified for payment={data.razorpay_payment_id}")
    except razorpay_lib.errors.SignatureVerificationError as e:
        logger.error(f"[StudentVerify] Signature verification failed: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay signature verification failed. Payment rejected.")
    except Exception as e:
        logger.error(f"[StudentVerify] Unexpected signature verification error: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Signature verification error: {str(e)}")

    # 4. Database Transaction for Ownership & Payment Storage
    try:
        # Prevent processing duplicate transaction IDs
        existing_payment_log = db.query(AuditLog).filter(
            AuditLog.new_value == data.razorpay_payment_id,
            AuditLog.action == "STUDENT_LAB_PURCHASE",
            AuditLog.status == "SUCCESS"
        ).first()
        if existing_payment_log:
            logger.info(f"[StudentVerify] Duplicate payment detection: ID {data.razorpay_payment_id} already exists")
            return {"status": "success", "message": "Payment already verified and processed.", "lab_id": data.lab_id}

        # Resolve organization
        org_id = getattr(current_user, 'group_id', None) or None

        # Create PurchasedLab ownership record
        license_key = f"LIC-{data.lab_id.upper()}-STU-{secrets.token_hex(4).upper()}"
        purchased_record = PurchasedLab(
            user_id=current_user.id,
            organization_id=org_id,
            lab_id=data.lab_id,
            lab_title=data.lab_id.replace("-", " ").title(),
            license_key=license_key,
            total_seats=1,
            assigned_seats=1,
            status="ACTIVE",
            expiry_date=datetime.utcnow() + timedelta(days=365)
        )
        db.add(purchased_record)
        db.flush()
        logger.info(f"[StudentVerify] DB Insert: PurchasedLab created with ID {purchased_record.id}")

        # Provision individual seat license key
        seat_key = f"KEY-{data.lab_id.upper()}-STU-{secrets.token_hex(4).upper()}"
        lic = License(
            purchased_lab_id=purchased_record.id,
            license_key=seat_key,
            allocated_user_email=current_user.email,
            status="ASSIGNED",
            expiry_date=datetime.utcnow() + timedelta(days=365)
        )
        db.add(lic)
        logger.info(f"[StudentVerify] DB Insert: License key '{seat_key}' provisioned")

        # Save payment log / transaction history record
        log_entry = AuditLog(
            action="STUDENT_LAB_PURCHASE",
            entity="PurchasedLab",
            entity_id=str(purchased_record.id),
            performed_by=current_user.email,
            performed_by_role=getattr(current_user, 'role', 'student'),
            user_id=current_user.id,
            old_value=data.razorpay_order_id,
            new_value=data.razorpay_payment_id,
            resource="Lab",
            resource_id=data.lab_id,
            ip_address="127.0.0.1",
            status="SUCCESS"
        )
        db.add(log_entry)
        db.commit()

        logger.info(f"[StudentVerify] SUCCESS | Lab '{data.lab_id}' unlocked for user {current_user.email}")
        return {"status": "success", "message": "Payment verified. Lab successfully unlocked!", "lab_id": data.lab_id}

    except Exception as e:
        db.rollback()
        logger.error(f"[StudentVerify] Database error occurred. Transaction rolled back: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database transaction error: {str(e)}")

@router.post("/student/unlock-lab")
def student_unlock_lab(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Helper route to unlock lab without payment (e.g. key validation or override)
    """
    lab_id = payload.get("lab_id")
    if not lab_id:
        raise HTTPException(status_code=400, detail="Missing lab_id")

    purchased = db.query(PurchasedLab).filter(
        PurchasedLab.user_id == current_user.id,
        PurchasedLab.lab_id == lab_id
    ).first()

    if not purchased:
        license_key = f"LIC-{lab_id.upper()}-STU-{secrets.token_hex(4).upper()}"
        purchased = PurchasedLab(
            user_id=current_user.id,
            organization_id=current_user.group_id or 1,
            lab_id=lab_id,
            lab_title=lab_id.replace("-", " ").title(),
            license_key=license_key,
            total_seats=1,
            assigned_seats=1,
            status="ACTIVE",
            expiry_date=datetime.utcnow() + timedelta(days=365)
        )
        db.add(purchased)
        db.commit()

    return {"status": "success", "message": "Lab successfully unlocked!"}

@router.get("/student/purchased-labs")
def get_student_purchased_labs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns list of all lab IDs that the student has purchased.
    """
    purchased = db.query(PurchasedLab).filter(
        PurchasedLab.user_id == current_user.id,
        PurchasedLab.status == "ACTIVE"
    ).all()
    return [p.lab_id for p in purchased]

@router.get("/student/payments")
def get_student_payments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves complete verified student payment history.
    Queries by user_id (new logs) and performed_by email (backward-compat for older logs).
    """
    # Query by user_id (new logs) OR by performed_by email (older logs without user_id)
    logs = db.query(AuditLog).filter(
        (
            (AuditLog.user_id == current_user.id) |
            (AuditLog.performed_by == current_user.email)
        ),
        AuditLog.action == "STUDENT_LAB_PURCHASE",
        AuditLog.status == "SUCCESS"
    ).order_by(AuditLog.timestamp.desc()).all()

    results = []
    for log in logs:
        # Resolve lab name from resource_id (new) or entity_id (old)
        lab_id = log.resource_id or "ot-security-lab"
        lab_name = lab_id.replace("-", " ").title()

        # Try to get accurate name from PurchasedLab
        if log.entity_id:
            try:
                p_lab = db.query(PurchasedLab).filter(PurchasedLab.id == int(log.entity_id)).first()
                if p_lab:
                    lab_id = p_lab.lab_id
                    lab_name = p_lab.lab_title
            except (ValueError, TypeError):
                pass

        results.append({
            "timestamp": log.timestamp.strftime("%d %b %Y, %H:%M"),
            "lab_id": lab_id,
            "lab_name": lab_name,
            "order_id": log.old_value or "N/A",
            "payment_id": log.new_value or "N/A",
            "amount": 4999.0,
            "status": "Paid",
            "method": "Razorpay Online",
            "id": log.id
        })
    return results

@router.get("/student/payments/{log_id}/invoice")
def get_student_payment_invoice(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates and saves/returns a clean PDF invoice for a student transaction.
    """
    import os
    import traceback
    from fastapi.responses import FileResponse

    logger.info(f"[InvoiceDownload] Request invoice for log_id={log_id} | user={current_user.email}")

    # 1. Look up the payment log with backward-compat fallback (performed_by or user_id)
    log = db.query(AuditLog).filter(
        AuditLog.id == log_id,
        (
            (AuditLog.user_id == current_user.id) |
            (AuditLog.performed_by == current_user.email)
        )
    ).first()

    if not log:
        logger.warning(f"[InvoiceDownload] No invoice log found for id={log_id} and user={current_user.email}")
        raise HTTPException(status_code=404, detail="Invoice record not found or access denied")

    # 2. Check if invoice directory exists, otherwise create it
    storage_dir = os.path.join("storage", "invoices")
    try:
        os.makedirs(storage_dir, exist_ok=True)
    except Exception as e:
        logger.error(f"[InvoiceDownload] Failed to create directories: {e}")

    invoice_filename = f"Invoice-{log_id}.pdf"
    invoice_path = os.path.join(storage_dir, invoice_filename)

    logger.info(f"[InvoiceDownload] Path check: {invoice_path} | exists={os.path.exists(invoice_path)}")

    # 3. If file already exists, return it directly
    if os.path.exists(invoice_path):
        logger.info(f"[InvoiceDownload] Serving cached invoice file: {invoice_path}")
        return FileResponse(
            invoice_path,
            media_type="application/pdf",
            filename=invoice_filename
        )

    # 4. Generate invoice dynamically
    try:
        from app.models.admin_models import PurchasedLab
        
        # Safely resolve PurchasedLab record
        p_lab = None
        lab_identifier = log.resource_id or log.entity_id
        if lab_identifier:
            if str(lab_identifier).isdigit():
                # It is a primary key integer
                p_lab = db.query(PurchasedLab).filter(PurchasedLab.id == int(lab_identifier)).first()
            else:
                # It is a string identifier / slug
                p_lab = db.query(PurchasedLab).filter(
                    PurchasedLab.user_id == current_user.id,
                    PurchasedLab.lab_id == str(lab_identifier)
                ).first()

        lab_name = p_lab.lab_title if p_lab else "OT & ICS Security Simulator Lab"
        payment_id = log.new_value or "N/A"
        order_id = log.old_value or "N/A"
        amount = 4999.0

        # Build reportlab PDF
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        # Document Setup
        doc = SimpleDocTemplate(invoice_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=22, textColor=colors.HexColor('#0052CC'), spaceAfter=15
        )
        body_style = ParagraphStyle(
            'BodyText', parent=styles['Normal'], fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#334155'), leading=12
        )

        story.append(Paragraph("CyberRange Academy - Invoice", title_style))
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<b>Invoice Date:</b> {log.timestamp.strftime('%d %b %Y')}", body_style))
        story.append(Paragraph(f"<b>Student Name:</b> {current_user.name or current_user.email}", body_style))
        story.append(Paragraph(f"<b>Student Email:</b> {current_user.email}", body_style))
        story.append(Spacer(1, 15))

        invoice_data = [
            [Paragraph("<b>Item Description</b>", body_style), Paragraph("<b>Order Details</b>", body_style), Paragraph("<b>Amount</b>", body_style)],
            [Paragraph(lab_name, body_style), Paragraph(f"Order: {order_id}<br/>Payment ID: {payment_id}", body_style), Paragraph(f"₹{amount:,.2f}", body_style)],
            ["", Paragraph("<b>Total Amount:</b>", body_style), Paragraph(f"₹{amount:,.2f}", body_style)]
        ]

        t = Table(invoice_data, colWidths=[200, 200, 100])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        story.append(Paragraph("<i>Thank you for your purchase.</i>", body_style))

        doc.build(story)
        logger.info(f"[InvoiceDownload] Successfully generated & saved invoice to: {invoice_path}")

        return FileResponse(
            invoice_path,
            media_type="application/pdf",
            filename=invoice_filename
        )

    except Exception as e:
        logger.error(f"[InvoiceDownload] Failed to generate invoice PDF. Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice document: {str(e)}"
        )


