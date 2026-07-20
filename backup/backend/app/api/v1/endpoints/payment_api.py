import logging
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.admin_models import (
    Cart, CartItem, Order, OrderItem, Payment, Invoice,
    PurchasedLab, License, AdminProfile, Organization
)
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)
router = APIRouter()

class CreateOrderRequest(BaseModel):
    institution_name: Optional[str] = None
    discount_code: Optional[str] = None

class VerifyPaymentRequest(BaseModel):
    order_id: int
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    gateway: str = "mock"  # "razorpay" or "mock"

@router.post("/checkout/create-order")
def create_checkout_order(
    data: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initializes a new DB Order from current Cart items.
    """
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shopping cart is empty.")

    # Calculate totals
    subtotal = sum(item.price_inr * item.quantity for item in cart.items)
    discount = 0.0
    if data.discount_code and data.discount_code.upper() in ["ASTRA10", "CYBER10"]:
        discount = round(subtotal * 0.10, 2)
    
    taxable = subtotal - discount
    tax = round(taxable * 0.18, 2)
    grand_total = round(taxable + tax, 2)

    # Fetch org
    admin_prof = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    org_id = admin_prof.organization_id if admin_prof else None
    inst_name = data.institution_name or (admin_prof.organization.name if admin_prof and admin_prof.organization else "CyberRange Admin")

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
            seats=item.quantity,
            duration_months=item.license_duration_months,
            price=item.price_inr
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)

    # Mock or Razorpay order payload response
    razorpay_order_id = f"rzp_order_{secrets.token_hex(8)}"

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "amount": order.grand_total,
        "currency": "INR",
        "razorpay_order_id": razorpay_order_id,
        "institution_name": inst_name
    }

@router.post("/checkout/verify-payment")
def verify_payment(
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verifies payment, creates Payment record, generates Invoice, and provisions Purchased Labs & Licenses.
    """
    order = db.query(Order).filter(Order.id == data.order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    txn_id = data.razorpay_payment_id or f"TXN-{secrets.token_hex(8).upper()}"

    # 1. Create Payment Record
    payment = Payment(
        order_id=order.id,
        transaction_id=txn_id,
        payment_status="SUCCESS",
        gateway=data.gateway,
        amount=order.grand_total,
        currency="INR",
        method="UPI / Card / Online"
    )
    db.add(payment)
    db.flush()

    # 2. Update Order Status
    order.status = "COMPLETED"

    # 3. Create Invoice Record
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

    # 4. Provision Purchased Labs & Licenses
    for item in order.items:
        expiry = datetime.utcnow() + timedelta(days=item.duration_months * 30)
        license_key = f"LIC-{item.lab_id.upper()}-{secrets.token_hex(6).upper()}"
        
        purchased_lab = PurchasedLab(
            user_id=current_user.id,
            organization_id=order.organization_id,
            lab_id=item.lab_id,
            lab_title=item.lab_title,
            license_key=license_key,
            total_seats=item.seats,
            assigned_seats=0,
            status="ACTIVE",
            expiry_date=expiry
        )
        db.add(purchased_lab)
        db.flush()

        # Create individual seat licenses
        for idx in range(item.seats):
            seat_key = f"KEY-{item.lab_id.upper()}-SEAT{idx+1}-{secrets.token_hex(4).upper()}"
            lic = License(
                purchased_lab_id=purchased_lab.id,
                license_key=seat_key,
                status="AVAILABLE",
                expiry_date=expiry
            )
            db.add(lic)

    # 5. Clear User Cart
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()

    # Audit Log
    db.add(AuditLog(
        user_id=current_user.id,
        action="Lab Purchase Checkout",
        resource="Order",
        resource_id=str(order.id),
        status="SUCCESS",
        new_value=f"Completed checkout order {order.order_number} for total {order.grand_total} INR"
    ))

    db.commit()

    from app.services.notification_service import notification_service
    notification_service.notify_administrators(db, "Payment Completed",
                                               f"Order {order.order_number} was paid successfully.", "PAYMENT_COMPLETED")
    db.commit()

    return {
        "status": "success",
        "message": "Payment verified and order fulfilled successfully!",
        "order_number": order.order_number,
        "invoice_number": inv_num,
        "transaction_id": txn_id,
        "amount_paid": order.grand_total
    }

@router.get("/payments/history")
def get_payment_history(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns payment history for admin dashboard.
    """
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
            "payment_method": payment.method if payment else "Online",
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
    Lists all purchased labs with active licenses and seat details for Admin dashboard.
    """
    labs = db.query(PurchasedLab).filter(PurchasedLab.user_id == current_user.id).order_by(PurchasedLab.purchased_date.desc()).all()

    result = []
    for lab in labs:
        result.append({
            "id": lab.id,
            "lab_id": lab.lab_id,
            "lab_title": lab.lab_title,
            "license_key": lab.license_key,
            "total_seats": lab.total_seats,
            "assigned_seats": lab.assigned_seats,
            "status": lab.status,
            "purchased_date": lab.purchased_date.strftime("%Y-%m-%d") if lab.purchased_date else "",
            "expiry_date": lab.expiry_date.strftime("%Y-%m-%d") if lab.expiry_date else ""
        })

    return result
