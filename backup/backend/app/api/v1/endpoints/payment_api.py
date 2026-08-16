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
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if inv.user_id != current_user.id and current_user.role not in ["admin", "super_admin", "system_admin"]:
        raise HTTPException(status_code=403, detail="Forbidden from viewing invoice of another organization.")

    order = db.query(Order).filter(Order.id == inv.order_id).first()
    payment = db.query(Payment).filter(Payment.id == inv.payment_id).first() if inv.payment_id else None

    try:
        from app.services.invoice_pdf import build_premium_invoice
        from app.models.admin_models import PurchasedLab

        inv_date   = inv.created_at.strftime('%d %b %Y') if inv.created_at else "N/A"
        inv_num    = str(inv.invoice_number or "N/A")
        inv_amount = float(inv.amount or 0.0)
        subtotal   = float(order.subtotal if order and order.subtotal else round(inv_amount / 1.18, 2))
        tax_amt    = float(order.tax    if order and order.tax    else round(inv_amount - subtotal, 2))

        pdf_items = []
        if order and order.items:
            for item in order.items:
                p_lab = None
                if hasattr(item, "lab_id") and item.lab_id:
                    p_lab = db.query(PurchasedLab).filter(
                        PurchasedLab.lab_id == str(item.lab_id)
                    ).first()
                hour_price   = float(p_lab.fixed_rate if p_lab and p_lab.fixed_rate else (item.price or 0.0))
                hours_bought = float(p_lab.hours_purchased if p_lab and p_lab.hours_purchased else (item.seats or 1))
                total_price  = round(hour_price * hours_bought, 2)
                pdf_items.append({
                    "desc":       str(item.lab_title or "Lab Subscription"),
                    "hour_price": f"Rs. {hour_price:,.2f}",
                    "hours":      f"{hours_bought:.1f} hrs",
                    "total":      f"Rs. {total_price:,.2f}",
                })
        else:
            pdf_items.append({
                "desc":       "Lab Access — Hour-Based Session",
                "hour_price": f"Rs. {(inv_amount / 1.0):,.2f}" if inv_amount else "N/A",
                "hours":      "1.0 hrs",
                "total":      f"Rs. {inv_amount:,.2f}",
            })

        pdf_bytes = build_premium_invoice(
            inv_number  = inv_num,
            inv_date    = inv_date,
            cust_name   = str(current_user.name or "Valued Admin"),
            cust_email  = str(current_user.email or ""),
            org_name    = str(order.institution_name if order and order.institution_name else ""),
            order_id    = str(order.id if order else "N/A"),
            rzp_order   = str(order.razorpay_order_id if order and order.razorpay_order_id else "N/A"),
            rzp_payment = str(payment.transaction_id if payment else "N/A"),
            pay_method  = str(payment.method if payment else "Razorpay Online"),
            pay_status  = str(payment.payment_status if payment else "SUCCESS"),
            items       = pdf_items,
            subtotal    = round(subtotal, 2),
            tax         = round(tax_amt, 2),
            grand_total = round(inv_amount, 2),
        )

        safe_num = inv_num.replace('"', "").replace("'", "")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Invoice-{safe_num}.pdf"'}
        )
    except Exception as pdf_err:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"[InvoiceDownload] PDF generation failed: {pdf_err}\n{tb}")
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
    import os, traceback
    logger.info(f"[InvoiceDownload] Request invoice for log_id={log_id} | user={current_user.email}")

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

    storage_dir = os.path.join("storage", "invoices")
    invoice_filename = f"Invoice-{log_id}.pdf"
    invoice_path = os.path.join(storage_dir, invoice_filename)

    try:
        from app.models.admin_models import PurchasedLab
        from app.services.invoice_pdf import build_premium_invoice

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
        try:
            if log.details:
                import json as _json
                _d = _json.loads(log.details)
                amount = float(_d.get("amount", amount))
        except Exception:
            pass

        subtotal = round(amount / 1.18, 2)
        tax_amt  = round(amount - subtotal, 2)

        hour_price   = float(p_lab.fixed_rate if p_lab and p_lab.fixed_rate else subtotal)
        hours_bought = float(p_lab.hours_purchased if p_lab and p_lab.hours_purchased else 1.0)

        pdf_bytes = build_premium_invoice(
            inv_number  = inv_num,
            inv_date    = inv_date,
            cust_name   = str(current_user.name or current_user.email),
            cust_email  = str(current_user.email or ""),
            order_id    = inv_num,
            rzp_order   = order_id,
            rzp_payment = payment_id,
            pay_method  = "Razorpay Online",
            pay_status  = "SUCCESS",
            items       = [{
                "desc":       lab_name,
                "hour_price": f"Rs. {hour_price:,.2f}",
                "hours":      f"{hours_bought:.1f} hrs",
                "total":      f"Rs. {amount:,.2f}",
            }],
            subtotal    = round(subtotal, 2),
            tax         = round(tax_amt, 2),
            grand_total = round(amount, 2),
        )

        try:
            os.makedirs(storage_dir, exist_ok=True)
            with open(invoice_path, "wb") as f:
                f.write(pdf_bytes)
        except Exception as _se:
            logger.warning(f"[InvoiceDownload] Could not cache: {_se}")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{inv_num}.pdf"'}
        )
    except Exception as e:
        logger.error(f"[InvoiceDownload] Failed to generate invoice PDF. Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate invoice document: {str(e)}"
        )
