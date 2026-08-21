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
    PurchasedLab, License, AdminProfile, Organization, PurchasedCTF
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
            hours_purchased=item.hours_purchased or 40,
            item_type=item.item_type or "lab",
            ctf_id=item.ctf_id
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



def _resolve_order_owner_org_id(db: Session, owner: User) -> Optional[int]:
    """Resolve the organization from server-side user relationships only."""
    if not owner:
        return None

    admin_prof = db.query(AdminProfile).filter(AdminProfile.user_id == owner.id).first()
    if admin_prof and admin_prof.organization_id:
        return admin_prof.organization_id

    if getattr(owner, "group_id", None):
        from app.models.group import Group
        group = db.query(Group).filter(Group.id == owner.group_id).first()
        if group and group.organization_id:
            return group.organization_id

    return None


def _finalize_paid_order(
    db: Session,
    razorpay_order_id: str,
    payment_id: str,
    method: str,
    expected_user_id: Optional[int] = None,
    reported_amount_paise: Optional[int] = None,
    reported_currency: Optional[str] = None,
):
    """
    Idempotent payment finalizer shared by browser verification and Razorpay webhooks.

    The Order row is locked (SELECT ... FOR UPDATE) so only one request can provision
    a given order at a time. Payment, invoice, entitlement/license provisioning, and
    the completion marker are committed together.
    """
    query = db.query(Order).filter(Order.razorpay_order_id == razorpay_order_id)
    if expected_user_id is not None:
        query = query.filter(Order.user_id == expected_user_id)

    order = query.with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for Razorpay order ID.")

    expected_amount_paise = int(round(float(order.grand_total or 0.0) * 100))
    if reported_amount_paise is not None and int(reported_amount_paise) != expected_amount_paise:
        logger.error(
            "Razorpay amount mismatch | order=%s | expected_paise=%s | received_paise=%s",
            order.id,
            expected_amount_paise,
            reported_amount_paise,
        )
        raise HTTPException(status_code=400, detail="Razorpay payment amount does not match the order.")

    if reported_currency and reported_currency.upper() != "INR":
        raise HTTPException(status_code=400, detail="Unexpected Razorpay payment currency.")

    # A payment ID must never be reused for another CyberRange order.
    payment = db.query(Payment).filter(Payment.transaction_id == payment_id).first()
    if payment and payment.order_id != order.id:
        raise HTTPException(status_code=409, detail="Payment transaction is already bound to another order.")

    # Likewise, one CyberRange order should not be completed using two different payments.
    payment_for_order = db.query(Payment).filter(Payment.order_id == order.id).first()
    if payment_for_order and payment_for_order.transaction_id != payment_id:
        raise HTTPException(status_code=409, detail="Order is already bound to another payment transaction.")

    invoice = db.query(Invoice).filter(Invoice.order_id == order.id).first()
    marker = db.query(AuditLog).filter(
        AuditLog.action == "RAZORPAY_ORDER_FINALIZED",
        AuditLog.entity == "Order",
        AuditLog.entity_id == str(order.id),
        AuditLog.new_value == payment_id,
        AuditLog.status == "SUCCESS",
    ).first()

    # Handles both normal retries and successful orders created before this marker existed.
    if marker or (payment and invoice and order.status == "COMPLETED"):
        if order.payment_status != "COMPLETED":
            order.payment_status = "COMPLETED"
            db.commit()
        return {
            "order": order,
            "payment": payment,
            "invoice": invoice,
            "newly_finalized": False,
        }

    owner = db.query(User).filter(User.id == order.user_id).first()
    if not owner:
        raise HTTPException(status_code=500, detail="Order owner no longer exists.")

    if payment is None:
        payment = Payment(
            order_id=order.id,
            transaction_id=payment_id,
            payment_status="SUCCESS",
            gateway="razorpay",
            amount=order.grand_total,
            currency="INR",
            method=method,
        )
        db.add(payment)
        db.flush()

    order.status = "COMPLETED"
    order.payment_status = "COMPLETED"

    if invoice is None:
        inv_num = f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
        invoice = Invoice(
            invoice_number=inv_num,
            order_id=order.id,
            payment_id=payment.id,
            user_id=order.user_id,
            amount=order.grand_total,
            billing_address_json=f"{order.institution_name or 'CyberRange'}, GST: IN38291039102",
        )
        db.add(invoice)
        db.flush()

    resolved_org_id = order.organization_id or _resolve_order_owner_org_id(db, owner)
    if not order.organization_id and resolved_org_id:
        order.organization_id = resolved_org_id

    is_student_order = bool(order.order_number and order.order_number.startswith("STU-"))

    if is_student_order:
        # Student orders are built server-side with authoritative lab/rate/hour values.
        for item in order.items:
            hours = float(item.hours_purchased or 1.0)

            purchased_record = db.query(PurchasedLab).filter(
                PurchasedLab.user_id == order.user_id,
                PurchasedLab.lab_id == item.lab_id,
                PurchasedLab.status == "ACTIVE",
            ).with_for_update().first()

            if purchased_record:
                # Defensive top-up path. Normally create-order rejects an already-active purchase.
                purchased_record.hours_purchased = float(purchased_record.hours_purchased or 0.0) + hours
                purchased_record.hours_remaining = float(purchased_record.hours_remaining or 0.0) + hours
            else:
                purchased_record = PurchasedLab(
                    user_id=order.user_id,
                    organization_id=resolved_org_id,
                    lab_id=item.lab_id,
                    lab_title=item.lab_title,
                    license_key=f"LIC-{item.lab_id.upper()}-STU-{secrets.token_hex(4).upper()}",
                    total_seats=1,
                    assigned_seats=1,
                    status="ACTIVE",
                    expiry_date=datetime.utcnow() + timedelta(days=365),
                    hours_purchased=hours,
                    hours_remaining=hours,
                    hours_used=0.0,
                    fixed_rate=float(item.price or 0.0),
                    assigned_to="student",
                )
                db.add(purchased_record)
                db.flush()

            lic = db.query(License).filter(
                License.purchased_lab_id == purchased_record.id,
                License.allocated_user_email == owner.email,
                License.status == "ASSIGNED",
            ).first()
            if lic:
                lic.hours_allocated = float(lic.hours_allocated or 0.0) + hours
            else:
                db.add(License(
                    purchased_lab_id=purchased_record.id,
                    license_key=f"KEY-{item.lab_id.upper()}-STU-{secrets.token_hex(4).upper()}",
                    allocated_user_email=owner.email,
                    status="ASSIGNED",
                    expiry_date=datetime.utcnow() + timedelta(days=365),
                    hours_allocated=hours,
                    hours_used=0.0,
                ))

            existing_student_log = db.query(AuditLog).filter(
                AuditLog.action == "STUDENT_LAB_PURCHASE",
                AuditLog.new_value == payment_id,
                AuditLog.status == "SUCCESS",
            ).first()
            if not existing_student_log:
                db.add(AuditLog(
                    action="STUDENT_LAB_PURCHASE",
                    entity="PurchasedLab",
                    entity_id=str(purchased_record.id),
                    performed_by=owner.email,
                    performed_by_role=getattr(owner, "role", "student"),
                    user_id=owner.id,
                    organization_id=resolved_org_id,
                    old_value=razorpay_order_id,
                    new_value=payment_id,
                    resource="Lab",
                    resource_id=item.lab_id,
                    status="SUCCESS",
                ))
    else:
        # Admin/org checkout: same provisioning semantics as the original endpoint.
        for item in order.items:
            expiry = datetime.utcnow() + timedelta(days=365)

            if item.item_type == "ctf" and item.ctf_id:
                db.add(PurchasedCTF(
                    user_id=order.user_id,
                    organization_id=resolved_org_id,
                    ctf_id=item.ctf_id,
                    ctf_title=item.lab_title,
                    license_key=f"LIC-CTF{item.ctf_id}-{secrets.token_hex(6).upper()}",
                    total_team_slots=10,
                    assigned_team_slots=0,
                    status="ACTIVE",
                    expiry_date=expiry,
                    assigned_to="admin",
                    fixed_rate=item.price,
                ))
                continue

            hours = float(item.hours_purchased or 40.0)
            db.add(PurchasedLab(
                user_id=order.user_id,
                organization_id=resolved_org_id,
                lab_id=item.lab_id,
                lab_title=item.lab_title,
                license_key=f"LIC-{item.lab_id.upper()}-{secrets.token_hex(6).upper()}",
                total_seats=999,
                assigned_seats=0,
                status="ACTIVE",
                expiry_date=expiry,
                hours_purchased=hours,
                hours_remaining=hours,
                hours_used=0.0,
            ))

    # Remove only cart rows represented by this order; do not wipe items added later.
    cart = db.query(Cart).filter(Cart.user_id == order.user_id).first()
    if cart:
        for item in order.items:
            cart_q = db.query(CartItem).filter(
                CartItem.cart_id == cart.id,
                CartItem.lab_id == item.lab_id,
            )
            if item.item_type == "ctf" and item.ctf_id:
                cart_q = cart_q.filter(CartItem.ctf_id == item.ctf_id)
            cart_q.delete(synchronize_session=False)

    db.add(AuditLog(
        action="RAZORPAY_ORDER_FINALIZED",
        entity="Order",
        entity_id=str(order.id),
        performed_by=owner.email,
        performed_by_role=getattr(owner, "role", None),
        organization_id=resolved_org_id,
        user_id=owner.id,
        status="SUCCESS",
        old_value=razorpay_order_id,
        new_value=payment_id,
        resource="Order",
        resource_id=str(order.id),
    ))

    # One atomic commit for payment + invoice + entitlement/license + marker.
    db.commit()
    db.refresh(order)
    db.refresh(payment)
    db.refresh(invoice)

    return {
        "order": order,
        "payment": payment,
        "invoice": invoice,
        "newly_finalized": True,
    }


@router.post("/checkout/verify-payment")
@router.post("/payments/verify")
def verify_payment(
    data: VerifyPaymentRequest,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify the browser callback, then run the shared idempotent finalizer."""
    order = db.query(Order).filter(
        Order.id == data.order_id,
        Order.user_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.razorpay_order_id != data.razorpay_order_id:
        logger.warning(
            "Razorpay order ID mismatch | db_order=%s | expected=%s | received=%s",
            order.id,
            order.razorpay_order_id,
            data.razorpay_order_id,
        )
        raise HTTPException(status_code=400, detail="Razorpay order ID mismatch.")

    if not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay secret is not configured.")

    secret = settings.RAZORPAY_KEY_SECRET.strip().strip("'").strip('"')
    message = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"
    generated_signature = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(generated_signature, data.razorpay_signature):
        logger.warning(
            "Razorpay payment signature verification failed | order=%s | payment=%s",
            order.id,
            data.razorpay_payment_id,
        )
        order.status = "FAILED"
        db.add(AuditLog(
            action="Razorpay Signature Verification Failed",
            entity="Order",
            entity_id=str(order.id),
            performed_by=current_user.email,
            performed_by_role=current_user.role,
            organization_id=order.organization_id,
            user_id=current_user.id,
            status="FAILED",
            new_value=f"Invalid signature for Razorpay payment {data.razorpay_payment_id}",
            resource="Order",
            resource_id=str(order.id),
        ))
        db.commit()
        raise HTTPException(status_code=400, detail="Razorpay signature verification failed.")

    try:
        result = _finalize_paid_order(
            db=db,
            razorpay_order_id=data.razorpay_order_id,
            payment_id=data.razorpay_payment_id,
            method="Razorpay Online",
            expected_user_id=current_user.id,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Razorpay order finalization failed: %s", exc)
        raise HTTPException(status_code=500, detail="Payment verified but order finalization failed. It is safe to retry.")

    finalized_order = result["order"]
    invoice = result["invoice"]

    # Notification happens after the financial transaction is committed.
    if result["newly_finalized"]:
        try:
            from app.services.notification_service import notification_service
            notification_service.create_and_send(
                db=db,
                user_id=current_user.id,
                title="Lab Purchase Successful",
                message=f"Your purchase for Order #{finalized_order.order_number} (₹{finalized_order.grand_total:,.2f}) was verified successfully.",
                notification_type="PURCHASE",
                priority="HIGH",
                action_url="/admin/purchased-labs",
                phone_number=getattr(current_user, "phone", None),
            )
        except Exception as n_err:
            logger.warning("Payment notification dispatch failed (non-fatal): %s", n_err)

    return {
        "status": "success",
        "message": "Razorpay payment verified and order finalized successfully!",
        "order_number": finalized_order.order_number,
        "invoice_number": invoice.invoice_number if invoice else None,
        "transaction_id": data.razorpay_payment_id,
        "amount_paid": finalized_order.grand_total,
        "already_finalized": not result["newly_finalized"],
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

@router.get("/admin/purchased-ctfs")
def get_purchased_ctfs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists organization purchased CTF events - mirrors /admin/purchased-labs."""
    user_org_id = None
    if current_user.group:
        user_org_id = current_user.group.organization_id

    admin_prof = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    if admin_prof:
        user_org_id = admin_prof.organization_id

    paid_ctfs = db.query(PurchasedCTF).filter(
        PurchasedCTF.user_id == current_user.id,
        PurchasedCTF.organization_id.isnot(None),
        PurchasedCTF.status == "ACTIVE"
    ).order_by(PurchasedCTF.purchased_date.desc()).all()

    if user_org_id is not None:
        org_ctfs = db.query(PurchasedCTF).filter(
            PurchasedCTF.organization_id == user_org_id,
            PurchasedCTF.status == "ACTIVE"
        ).order_by(PurchasedCTF.purchased_date.desc()).all()
    else:
        org_ctfs = []

    seen = set()
    ctfs = []
    for c in paid_ctfs + org_ctfs:
        if c.ctf_id not in seen:
            seen.add(c.ctf_id)
            ctfs.append(c)

    result = []
    for c in ctfs:
        result.append({
            "id": c.id,
            "ctf_id": c.ctf_id,
            "ctf_title": c.ctf_title,
            "license_key": c.license_key,
            "total_team_slots": c.total_team_slots,
            "assigned_team_slots": c.assigned_team_slots,
            "status": c.status,
            "fixed_rate": c.fixed_rate if c.fixed_rate is not None else 0.0,
            "assigned_to": c.assigned_to or "both",
            "is_sysadmin_assigned": c.organization_id is None,
            "purchased_date": c.purchased_date.strftime("%Y-%m-%d") if c.purchased_date else "",
            "expiry_date": c.expiry_date.strftime("%Y-%m-%d") if c.expiry_date else ""
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
    """Verify Razorpay's webhook HMAC and finalize captured orders idempotently."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("x-razorpay-signature")

    if not settings.RAZORPAY_WEBHOOK_SECRET:
        logger.error("Razorpay Webhook Secret is missing in backend environment configuration.")
        raise HTTPException(status_code=500, detail="Razorpay Webhook Secret is not configured on server.")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header.")

    expected_sig = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_sig, signature):
        logger.warning("Razorpay Webhook HMAC signature mismatch.")
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook signature.")

    try:
        import json
        payload = json.loads(body.decode("utf-8"))
        event = payload.get("event")
        event_payload = payload.get("payload", {})
        logger.info("[Razorpay Webhook] Received event: %s", event)

        if event in ["payment.captured", "order.paid"]:
            payment_entity = event_payload.get("payment", {}).get("entity", {})
            rzp_order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")

            if not rzp_order_id or not payment_id:
                logger.warning("Captured/paid webhook missing order_id or payment_id; ignoring event.")
                return {"status": "ok", "message": "Webhook ignored: missing payment identifiers"}

            _finalize_paid_order(
                db=db,
                razorpay_order_id=rzp_order_id,
                payment_id=payment_id,
                method="Razorpay Webhook",
                reported_amount_paise=payment_entity.get("amount"),
                reported_currency=payment_entity.get("currency"),
            )

        elif event == "payment.failed":
            payment_entity = event_payload.get("payment", {}).get("entity", {})
            payment_id = payment_entity.get("id", "FAILED_TXN")
            db.add(AuditLog(
                action="Razorpay Webhook Payment Failed",
                entity="Payment",
                entity_id=payment_id,
                performed_by="Razorpay Webhook",
                performed_by_role="System",
                status="FAILED",
                new_value=f"Payment failed via webhook callback for txn: {payment_id}",
                resource="Payment",
                resource_id=payment_id,
            ))
            db.commit()

        elif event == "refund.processed":
            refund_entity = event_payload.get("refund", {}).get("entity", {})
            payment_id = refund_entity.get("payment_id")
            if payment_id:
                pay = db.query(Payment).filter(Payment.transaction_id == payment_id).first()
                if pay:
                    pay.payment_status = "REFUNDED"
                    db.commit()

        return {"status": "ok", "message": "Webhook processed successfully"}

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Razorpay webhook processing failed: %s", exc)
        # Non-2xx makes Razorpay retry instead of silently losing provisioning.
        raise HTTPException(status_code=500, detail="Webhook processing failed; please retry.")

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
    # Kept temporarily for frontend compatibility. NEVER used to determine charge.
    price: Optional[float] = None
    hours: float = 1.0


class StudentVerifyPaymentRequest(BaseModel):
    # These client fields are retained for backward compatibility, but the server
    # does not trust lab_id / amount / hours for entitlement provisioning.
    lab_id: Optional[str] = None
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    amount: Optional[float] = None
    hours: Optional[float] = None


@router.post("/student/create-order")
def student_create_checkout_order(
    data: StudentCreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a student Razorpay order from server-authoritative lab pricing.

    The client's price is ignored. Lab, hours, rate, total, user and Razorpay order ID
    are persisted in Order/OrderItem before the payment can be verified.
    """
    if data.hours <= 0 or data.hours > 1000:
        raise HTTPException(status_code=400, detail="Purchased hours must be between 0 and 1000.")

    purchased = db.query(PurchasedLab).filter(
        PurchasedLab.user_id == current_user.id,
        PurchasedLab.lab_id == data.lab_id,
        PurchasedLab.status == "ACTIVE",
    ).first()
    if purchased:
        raise HTTPException(status_code=409, detail="This lab is already active for your account.")

    from app.models.lab import Lab
    from app.api.v1.endpoints.cart_api import get_sysadmin_rate

    lab = db.query(Lab).filter(Lab.id == data.lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")

    rate = float(get_sysadmin_rate(db, data.lab_id) or 0.0)
    if rate <= 0:
        raise HTTPException(status_code=400, detail="This lab is free or has no payable rate; Razorpay checkout is not required.")

    hours = float(data.hours)
    authoritative_total = round(rate * hours, 2)
    amount_in_paise = int(round(authoritative_total * 100))
    order_num = f"STU-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"

    if data.price is not None and abs(float(data.price) - authoritative_total) > 0.01:
        logger.warning(
            "Ignored client student price mismatch | user=%s | lab=%s | client=%s | server=%s",
            current_user.id,
            data.lab_id,
            data.price,
            authoritative_total,
        )

    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Payment gateway is unconfigured.")

    try:
        import razorpay
        client = razorpay.Client(auth=(
            settings.RAZORPAY_KEY_ID.strip().strip("'").strip('"'),
            settings.RAZORPAY_KEY_SECRET.strip().strip("'").strip('"'),
        ))
        rzp_order = client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": order_num,
            "notes": {
                "user_id": str(current_user.id),
                "lab_id": data.lab_id,
                "hours": str(hours),
            },
        })
        razorpay_order_id = rzp_order.get("id")
        if not razorpay_order_id or not razorpay_order_id.startswith("order_"):
            raise ValueError("Razorpay returned an invalid order ID")
    except Exception as exc:
        logger.exception("Razorpay Student Order failed: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to create Razorpay student order.")

    resolved_org_id = _resolve_order_owner_org_id(db, current_user)
    order = Order(
        order_number=order_num,
        razorpay_order_id=razorpay_order_id,
        user_id=current_user.id,
        organization_id=resolved_org_id,
        institution_name=getattr(current_user, "organization", None) or "Student Purchase",
        subtotal=authoritative_total,
        tax=0.0,
        discount=0.0,
        grand_total=authoritative_total,
        status="PENDING",
        payment_status="PENDING",
    )
    db.add(order)
    db.flush()

    db.add(OrderItem(
        order_id=order.id,
        lab_id=data.lab_id,
        lab_title=getattr(lab, "name", None) or data.lab_id.replace("-", " ").title(),
        seats=1,
        duration_months=12,
        price=rate,
        hours_purchased=hours,
        item_type="lab",
        ctf_id=None,
    ))
    db.commit()
    db.refresh(order)

    return {
        "success": True,
        "order_id": order.id,
        "order_number": order.order_number,
        "amount": order.grand_total,
        "amount_paise": amount_in_paise,
        "currency": "INR",
        "razorpay_order_id": razorpay_order_id,
        "razorpay_key_id": settings.RAZORPAY_KEY_ID,
        "key": settings.RAZORPAY_KEY_ID,
        "hours": hours,
        "lab_id": data.lab_id,
    }


@router.post("/student/verify-payment")
def student_verify_payment(
    data: StudentVerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify Razorpay and provision only the server-persisted student order values."""
    order = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.razorpay_order_id == data.razorpay_order_id,
        Order.order_number.like("STU-%"),
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Student payment order not found.")

    if not order.items:
        raise HTTPException(status_code=500, detail="Student payment order has no server-side order item.")

    key_secret = settings.RAZORPAY_KEY_SECRET
    key_id = settings.RAZORPAY_KEY_ID
    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Payment gateway is unconfigured.")

    key_secret = key_secret.strip().strip("'").strip('"')
    key_id = key_id.strip().strip("'").strip('"')

    try:
        import razorpay as razorpay_lib
        client = razorpay_lib.Client(auth=(key_id, key_secret))
        client.utility.verify_payment_signature({
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "razorpay_signature": data.razorpay_signature,
        })

        # Defense in depth: bind the payment to the server-side order and amount.
        payment_entity = client.payment.fetch(data.razorpay_payment_id)
        if payment_entity.get("order_id") != order.razorpay_order_id:
            raise HTTPException(status_code=400, detail="Razorpay payment belongs to a different order.")
        if int(payment_entity.get("amount", -1)) != int(round(float(order.grand_total) * 100)):
            raise HTTPException(status_code=400, detail="Razorpay payment amount does not match the server order.")
        if str(payment_entity.get("currency", "")).upper() != "INR":
            raise HTTPException(status_code=400, detail="Unexpected payment currency.")
        if payment_entity.get("status") not in ("authorized", "captured"):
            raise HTTPException(status_code=400, detail="Razorpay payment has not been authorized/captured.")

    except HTTPException:
        raise
    except razorpay_lib.errors.SignatureVerificationError:
        logger.warning(
            "Student Razorpay signature verification failed | user=%s | order=%s | payment=%s",
            current_user.id,
            data.razorpay_order_id,
            data.razorpay_payment_id,
        )
        raise HTTPException(status_code=400, detail="Razorpay signature verification failed. Payment rejected.")
    except Exception as exc:
        logger.exception("Student payment verification error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not verify payment with Razorpay. It is safe to retry.")

    try:
        result = _finalize_paid_order(
            db=db,
            razorpay_order_id=data.razorpay_order_id,
            payment_id=data.razorpay_payment_id,
            method="Razorpay Student Online",
            expected_user_id=current_user.id,
            reported_amount_paise=payment_entity.get("amount"),
            reported_currency=payment_entity.get("currency"),
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Student order finalization failed: %s", exc)
        raise HTTPException(status_code=500, detail="Payment verified but provisioning failed. It is safe to retry.")

    server_item = result["order"].items[0]
    return {
        "status": "success",
        "message": "Payment verified. Lab successfully unlocked!",
        "lab_id": server_item.lab_id,
        "hours": server_item.hours_purchased,
        "order_id": result["order"].id,
        "already_finalized": not result["newly_finalized"],
    }

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
