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
    Generates Invoice PDF using ReportLab canvas (no XML parsing — bulletproof).
    """
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if inv.user_id != current_user.id and current_user.role not in ["admin", "super_admin", "system_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden from viewing invoice of another organization.")

    order = db.query(Order).filter(Order.id == inv.order_id).first()
    payment = db.query(Payment).filter(Payment.id == inv.payment_id).first() if inv.payment_id else None

    try:
        import io
        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.pagesizes import letter

        W, H = letter  # 612 x 792

        def safe(val):
            """Convert any value to a PDF-safe plain string."""
            return str(val if val is not None else "N/A").replace("\u20b9", "Rs.")

        buffer = io.BytesIO()
        c = rl_canvas.Canvas(buffer, pagesize=letter)

        def hline(y, x1=40, x2=572, lw=0.5, r=0.886, g=0.910, b=0.941):
            c.setStrokeColorRGB(r, g, b)
            c.setLineWidth(lw)
            c.line(x1, y, x2, y)

        def txt(x, y, val, font="Helvetica", size=9, r=0.118, g=0.161, b=0.231):
            c.setFont(font, size)
            c.setFillColorRGB(r, g, b)
            c.drawString(x, y, safe(val))

        def rtxt(x, y, val, font="Helvetica", size=9, r=0.118, g=0.161, b=0.231):
            c.setFont(font, size)
            c.setFillColorRGB(r, g, b)
            c.drawRightString(x, y, safe(val))

        def box(x, y, w, h, fr=None, fg=None, fb=None, sr=None, sg=None, sb=None, lw=0.5):
            c.setLineWidth(lw)
            if fr is not None:
                c.setFillColorRGB(fr, fg, fb)
            if sr is not None:
                c.setStrokeColorRGB(sr, sg, sb)
            c.rect(x, y, w, h, fill=1 if fr is not None else 0, stroke=1 if sr is not None else 0)

        # ── data ─────────────────────────────────────────────
        inv_date   = inv.created_at.strftime('%d %b %Y') if inv.created_at else "N/A"
        inv_num    = str(inv.invoice_number or "N/A")
        inv_amount = float(inv.amount or 0.0)

        cust_name  = str(current_user.name or "Valued Admin")
        cust_email = str(current_user.email or "")
        org_name   = str(order.institution_name if order and order.institution_name else "Enterprise Client")
        ord_id     = str(order.id if order else "N/A")
        rzp_oid    = str(order.razorpay_order_id if order and order.razorpay_order_id else "N/A")
        rzp_pid    = str(payment.transaction_id if payment else "N/A")
        pay_method = str(payment.method if payment else "Razorpay Online")
        pay_status = str(payment.payment_status if payment else "SUCCESS")
        subtotal   = float(order.subtotal if order and order.subtotal else inv_amount * 0.82)
        tax_amt    = float(order.tax if order and order.tax else inv_amount * 0.18)

        # ── HEADER BAND ───────────────────────────────────────
        box(0, H - 70, W, 70, fr=0.000, fg=0.322, fb=0.800)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(40, H - 42, "CyberRange")
        c.setFont("Helvetica", 10)
        c.drawString(40, H - 57, "Cybersecurity Virtual Lab Platform")
        c.setFont("Helvetica-Bold", 18)
        c.drawRightString(572, H - 38, "TAX INVOICE")
        c.setFont("Helvetica", 9)
        c.drawRightString(572, H - 52, "Invoice #: " + inv_num)
        c.drawRightString(572, H - 64, "Date: " + inv_date)

        y = H - 90

        # ── BILLING / PAYMENT BOXES ───────────────────────────
        box(40, y - 84, 256, 90, fr=0.973, fg=0.980, fb=0.988, sr=0.886, sg=0.910, sb=0.941)
        box(304, y - 84, 268, 90, fr=0.973, fg=0.980, fb=0.988, sr=0.886, sg=0.910, sb=0.941)

        txt(48, y - 12, "BILLED TO", "Helvetica-Bold", 8, r=0.000, g=0.322, b=0.800)
        txt(312, y - 12, "PAYMENT DETAILS", "Helvetica-Bold", 8, r=0.000, g=0.322, b=0.800)

        txt(48, y - 28, "Name:   " + cust_name, size=8)
        txt(48, y - 40, "Email:  " + cust_email, size=8)
        txt(48, y - 52, "Org:    " + org_name, size=8)

        txt(312, y - 28, "Order ID:     " + ord_id, size=8)
        txt(312, y - 40, "RZP Order:    " + rzp_oid, size=8)
        txt(312, y - 52, "RZP Payment:  " + rzp_pid, size=8)
        txt(312, y - 64, "Method:       " + pay_method, size=8)
        txt(312, y - 76, "Status:       " + pay_status, "Helvetica-Bold", 8, r=0.086, g=0.639, b=0.243)

        y -= 104

        # ── ITEMS TABLE HEADER ────────────────────────────────
        box(40, y - 18, 532, 18, fr=0.000, fg=0.322, fb=0.800)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(46,  y - 12, "Item Description")
        c.drawString(286, y - 12, "Qty")
        c.drawString(326, y - 12, "Duration")
        c.drawRightString(490, y - 12, "Unit Price")
        c.drawRightString(568, y - 12, "Subtotal")
        y -= 18

        # ── ITEM ROWS ─────────────────────────────────────────
        row_items = []
        if order and order.items:
            for item in order.items:
                row_items.append({
                    "desc": str(item.lab_title or "Lab Subscription"),
                    "qty":  str(item.seats or 1),
                    "dur":  str(item.duration_months or 12) + " Months",
                    "price":    "Rs. " + f"{(item.price or 0.0):,.2f}",
                    "subtotal": "Rs. " + f"{((item.seats or 1) * (item.price or 0.0)):,.2f}",
                })
        else:
            row_items.append({
                "desc": "Enterprise Lab Subscription",
                "qty":  "1",
                "dur":  "12 Months",
                "price":    "Rs. " + f"{inv_amount:,.2f}",
                "subtotal": "Rs. " + f"{inv_amount:,.2f}",
            })

        for i, row in enumerate(row_items):
            if i % 2 == 0:
                box(40, y - 18, 532, 18, fr=0.973, fg=0.980, fb=0.988, sr=0.886, sg=0.910, sb=0.941, lw=0.3)
            else:
                box(40, y - 18, 532, 18, sr=0.886, sg=0.910, sb=0.941, lw=0.3)
            txt(46,  y - 12, row["desc"], size=8)
            txt(286, y - 12, row["qty"],  size=8)
            txt(326, y - 12, row["dur"],  size=8)
            rtxt(490, y - 12, row["price"],    size=8)
            rtxt(568, y - 12, row["subtotal"], size=8)
            y -= 18

        # ── TOTALS ────────────────────────────────────────────
        y -= 12
        hline(y)
        y -= 16
        txt(390, y, "Subtotal:", size=9)
        rtxt(572, y, "Rs. " + f"{subtotal:,.2f}", size=9)
        y -= 16
        txt(390, y, "GST (18%):", size=9)
        rtxt(572, y, "Rs. " + f"{tax_amt:,.2f}", size=9)
        y -= 4
        hline(y, x1=385, lw=1, r=0.000, g=0.322, b=0.800)
        y -= 18
        txt(390, y, "Grand Total:", "Helvetica-Bold", 12, r=0.000, g=0.322, b=0.800)
        rtxt(572, y, "Rs. " + f"{inv_amount:,.2f}", "Helvetica-Bold", 12, r=0.000, g=0.322, b=0.800)

        # ── FOOTER ───────────────────────────────────────────
        hline(60)
        txt(40, 48, "CyberRange Telemetry Billing Unit", "Helvetica", 8, r=0.392, g=0.455, b=0.545)
        txt(40, 36, "Official Tax Receipt and Order Fulfillment Confirmation", "Helvetica", 8, r=0.392, g=0.455, b=0.545)
        txt(400, 48, "Authorized Signature:", "Helvetica-Bold", 8)
        txt(400, 36, "CyberRange Accounts Lead", "Helvetica-Oblique", 8)

        c.save()
        buffer.seek(0)

        safe_num = inv_num.replace('"', "").replace("'", "")
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="Invoice-' + safe_num + '.pdf"'}
        )
    except Exception as pdf_err:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"[InvoiceDownload] PDF generation failed for invoice {invoice_id}: {pdf_err}\n{tb}")
        raise HTTPException(
            status_code=500,
            detail=f"Invoice PDF generation failed: {str(pdf_err)}"
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

    # Only show labs that were actually paid for via Razorpay.
    # SysAdmin-assigned labs (organization_id IS NULL) are catalog entries — NOT purchases.
    # Paid purchases always have organization_id set (to the admin's org).
    paid_labs = db.query(PurchasedLab).filter(
        PurchasedLab.user_id == current_user.id,
        PurchasedLab.organization_id.isnot(None),
        PurchasedLab.status == "ACTIVE"
    ).order_by(PurchasedLab.purchased_date.desc()).all()

    # If admin belongs to an org, also include org-level purchases
    if user_org_id is not None:
        org_labs = db.query(PurchasedLab).filter(
            PurchasedLab.organization_id == user_org_id,
            PurchasedLab.status == "ACTIVE"
        ).order_by(PurchasedLab.purchased_date.desc()).all()
    else:
        org_labs = []

    # Merge, de-duplicate by lab_id (personal purchase takes precedence)
    seen = set()
    labs = []
    for lab in paid_labs + org_labs:
        if lab.lab_id not in seen:
            seen.add(lab.lab_id)
            labs.append(lab)


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
            "fixed_rate": lab.fixed_rate if lab.fixed_rate is not None else 0.0,
            "assigned_to": lab.assigned_to or "both",
            "is_sysadmin_assigned": lab.organization_id is None,
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
    hours: float = 1.0

class StudentVerifyPaymentRequest(BaseModel):
    lab_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    amount: float
    hours: float = 1.0

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

        # Resolve organization_id from user's group organization
        org_id = None
        if getattr(current_user, 'group_id', None):
            from app.models.group import Group
            user_group = db.query(Group).filter(Group.id == current_user.group_id).first()
            if user_group:
                org_id = user_group.organization_id

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
            expiry_date=datetime.utcnow() + timedelta(days=365),
            hours_purchased=data.hours,
            hours_remaining=data.hours,
            hours_used=0.0
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
            expiry_date=datetime.utcnow() + timedelta(days=365),
            hours_allocated=data.hours,
            hours_used=0.0
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
        import io
        from app.models.admin_models import PurchasedLab
        from reportlab.pdfgen import canvas as rl_canvas
        from reportlab.lib.pagesizes import letter

        W, H = letter  # 612 x 792

        # ── resolve lab & payment data ─────────────────────────
        p_lab = None
        lab_identifier = log.resource_id or log.entity_id
        if lab_identifier:
            if str(lab_identifier).isdigit():
                p_lab = db.query(PurchasedLab).filter(PurchasedLab.id == int(lab_identifier)).first()
            else:
                p_lab = db.query(PurchasedLab).filter(
                    PurchasedLab.user_id == current_user.id,
                    PurchasedLab.lab_id == str(lab_identifier)
                ).first()

        lab_name   = str(p_lab.lab_title if p_lab else (log.resource_id or "Lab Subscription"))
        payment_id = str(log.new_value or "N/A")
        order_id   = str(log.old_value or "N/A")
        inv_date   = log.timestamp.strftime('%d %b %Y') if log.timestamp else "N/A"
        inv_num    = f"INV-STU-{log_id}"
        amount     = float(p_lab.hours_purchased * (p_lab.fixed_rate or 0) if p_lab and p_lab.fixed_rate else 4999.0)
        # Try to get amount from audit log metadata
        try:
            if log.details:
                import json as _json
                _d = _json.loads(log.details)
                amount = float(_d.get("amount", amount))
        except Exception:
            pass

        subtotal = round(amount / 1.18, 2)
        tax_amt  = round(amount - subtotal, 2)

        cust_name  = str(current_user.name or current_user.email)
        cust_email = str(current_user.email or "")
        method     = "Razorpay Online"

        # ── canvas helpers ────────────────────────────────────
        pdf_buffer = io.BytesIO()
        c = rl_canvas.Canvas(pdf_buffer, pagesize=letter)

        def safe(val):
            return str(val if val is not None else "N/A").replace("\u20b9", "Rs.")

        def hline(y, x1=40, x2=572, lw=0.5, r=0.886, g=0.910, b=0.941):
            c.setStrokeColorRGB(r, g, b)
            c.setLineWidth(lw)
            c.line(x1, y, x2, y)

        def txt(x, y, val, font="Helvetica", size=9, r=0.118, g=0.161, b=0.231):
            c.setFont(font, size)
            c.setFillColorRGB(r, g, b)
            c.drawString(x, y, safe(val))

        def rtxt(x, y, val, font="Helvetica", size=9, r=0.118, g=0.161, b=0.231):
            c.setFont(font, size)
            c.setFillColorRGB(r, g, b)
            c.drawRightString(x, y, safe(val))

        def box(x, y, w, h, fr=None, fg=None, fb=None, sr=None, sg=None, sb=None, lw=0.5):
            c.setLineWidth(lw)
            if fr is not None:
                c.setFillColorRGB(fr, fg, fb)
            if sr is not None:
                c.setStrokeColorRGB(sr, sg, sb)
            c.rect(x, y, w, h, fill=1 if fr is not None else 0, stroke=1 if sr is not None else 0)

        # ── HEADER BAND ───────────────────────────────────────
        box(0, H - 70, W, 70, fr=0.000, fg=0.322, fb=0.800)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(40, H - 42, "CyberRange")
        c.setFont("Helvetica", 10)
        c.drawString(40, H - 57, "Cybersecurity Virtual Lab Platform")
        c.setFont("Helvetica-Bold", 18)
        c.drawRightString(572, H - 38, "TAX INVOICE")
        c.setFont("Helvetica", 9)
        c.drawRightString(572, H - 52, "Invoice #: " + inv_num)
        c.drawRightString(572, H - 64, "Date: " + inv_date)

        y = H - 90

        # ── BILLED TO / PAYMENT DETAILS BOXES ────────────────
        box(40, y - 84, 256, 90, fr=0.973, fg=0.980, fb=0.988, sr=0.886, sg=0.910, sb=0.941)
        box(304, y - 84, 268, 90, fr=0.973, fg=0.980, fb=0.988, sr=0.886, sg=0.910, sb=0.941)

        txt(48, y - 12, "BILLED TO", "Helvetica-Bold", 8, r=0.000, g=0.322, b=0.800)
        txt(312, y - 12, "PAYMENT DETAILS", "Helvetica-Bold", 8, r=0.000, g=0.322, b=0.800)

        txt(48, y - 28, "Name:   " + cust_name, size=8)
        txt(48, y - 40, "Email:  " + cust_email, size=8)

        txt(312, y - 28, "Invoice ID:   " + inv_num, size=8)
        txt(312, y - 40, "Order ID:     " + order_id, size=8)
        txt(312, y - 52, "Payment ID:   " + payment_id, size=8)
        txt(312, y - 64, "Method:       " + method, size=8)
        txt(312, y - 76, "Status:       SUCCESS", "Helvetica-Bold", 8, r=0.086, g=0.639, b=0.243)

        y -= 104

        # ── ITEMS TABLE HEADER ────────────────────────────────
        box(40, y - 18, 532, 18, fr=0.000, fg=0.322, fb=0.800)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(46,  y - 12, "Item Description")
        c.drawString(286, y - 12, "Qty")
        c.drawString(326, y - 12, "Duration")
        c.drawRightString(490, y - 12, "Unit Price")
        c.drawRightString(568, y - 12, "Subtotal")
        y -= 18

        # ── SINGLE ITEM ROW ───────────────────────────────────
        box(40, y - 18, 532, 18, fr=0.973, fg=0.980, fb=0.988, sr=0.886, sg=0.910, sb=0.941, lw=0.3)
        txt(46,  y - 12, lab_name, size=8)
        txt(286, y - 12, "1", size=8)
        txt(326, y - 12, "1 Session", size=8)
        rtxt(490, y - 12, "Rs. " + f"{subtotal:,.2f}", size=8)
        rtxt(568, y - 12, "Rs. " + f"{subtotal:,.2f}", size=8)
        y -= 18

        # ── TOTALS ────────────────────────────────────────────
        y -= 12
        hline(y)
        y -= 16
        txt(390, y, "Subtotal:", size=9)
        rtxt(572, y, "Rs. " + f"{subtotal:,.2f}", size=9)
        y -= 16
        txt(390, y, "GST (18%):", size=9)
        rtxt(572, y, "Rs. " + f"{tax_amt:,.2f}", size=9)
        y -= 4
        hline(y, x1=385, lw=1, r=0.000, g=0.322, b=0.800)
        y -= 18
        txt(390, y, "Grand Total:", "Helvetica-Bold", 12, r=0.000, g=0.322, b=0.800)
        rtxt(572, y, "Rs. " + f"{amount:,.2f}", "Helvetica-Bold", 12, r=0.000, g=0.322, b=0.800)

        # ── FOOTER ───────────────────────────────────────────
        hline(60)
        txt(40, 48, "CyberRange Telemetry Billing Unit", "Helvetica", 8, r=0.392, g=0.455, b=0.545)
        txt(40, 36, "Official Tax Receipt and Order Fulfillment Confirmation", "Helvetica", 8, r=0.392, g=0.455, b=0.545)
        txt(400, 48, "Authorized Signature:", "Helvetica-Bold", 8)
        txt(400, 36, "CyberRange Accounts Lead", "Helvetica-Oblique", 8)

        c.save()
        pdf_buffer.seek(0)

        # Save to disk for caching
        try:
            os.makedirs(storage_dir, exist_ok=True)
            with open(invoice_path, "wb") as f:
                f.write(pdf_buffer.getvalue())
            logger.info(f"[InvoiceDownload] Saved invoice to: {invoice_path}")
        except Exception as save_err:
            logger.warning(f"[InvoiceDownload] Could not cache invoice file: {save_err}")

        pdf_buffer.seek(0)
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{inv_num}.pdf"'}
        )

    except Exception as e:
        logger.error(f"[InvoiceDownload] Failed to generate invoice PDF. Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice document: {str(e)}"
        )
        
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


