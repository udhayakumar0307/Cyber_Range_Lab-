import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.admin_models import Cart, CartItem

logger = logging.getLogger(__name__)
router = APIRouter()

class AddToCartRequest(BaseModel):
    lab_id: str
    lab_title: str
    lab_image: Optional[str] = None
    hours_purchased: int = 1

class UpdateCartItemRequest(BaseModel):
    hours_purchased: Optional[int] = None

def get_or_create_user_cart(db: Session, user_id: int) -> Cart:
    from sqlalchemy.orm import joinedload
    cart = db.query(Cart).options(joinedload(Cart.items)).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart

def get_sysadmin_rate(db: Session, lab_id: str) -> float:
    """
    Fetch the per-hour rate set by SysAdmin for a lab.
    Priority: PurchasedLab.fixed_rate (org IS NULL) > Lab.price_per_hour > 0.0
    """
    from app.models.admin_models import PurchasedLab
    assignment = (
        db.query(PurchasedLab)
        .filter(
            PurchasedLab.lab_id == lab_id,
            PurchasedLab.organization_id.is_(None),
            PurchasedLab.status == "ACTIVE"
        )
        .first()
    )
    if assignment and assignment.fixed_rate is not None and assignment.fixed_rate > 0:
        return float(assignment.fixed_rate)

    # Fallback: read from Lab.price_per_hour
    from app.models.lab import Lab
    lab_obj = db.query(Lab).filter(Lab.id == lab_id).first()
    if lab_obj and lab_obj.price_per_hour and lab_obj.price_per_hour > 0:
        return float(lab_obj.price_per_hour)

    return 0.0

@router.get("")
def get_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns the user's current active shopping cart.
    Prices are fetched from the SysAdmin's assigned fixed_rate.
    """
    cart = get_or_create_user_cart(db, current_user.id)
    items = []
    subtotal = 0.0

    for item in cart.items:
        hours = item.hours_purchased or 1

        # Always resolve rate from SysAdmin's PurchasedLab.fixed_rate
        rate = get_sysadmin_rate(db, item.lab_id)

        # Keep DB in sync with correct rate × hours
        item.price_inr = rate * hours
        item.hours_purchased = hours
        db.commit()

        item_total = rate * hours
        subtotal += item_total
        items.append({
            "id": item.id,
            "lab_id": item.lab_id,
            "lab_title": item.lab_title,
            "lab_image": item.lab_image or "",
            "price_inr": rate,       # Per-hour rate (SysAdmin fixed_rate)
            "hours_purchased": hours,
            "item_total": item_total
        })

    tax = round(subtotal * 0.18, 2)  # 18% GST
    grand_total = round(subtotal + tax, 2)

    return {
        "cart_id": cart.id,
        "items": items,
        "item_count": len(items),
        "subtotal": subtotal,
        "tax": tax,
        "discount": 0.0,
        "grand_total": grand_total
    }

@router.post("/items")
def add_item_to_cart(
    data: AddToCartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Adds a lab item to the user's cart.
    Price is resolved from SysAdmin's fixed_rate.
    """
    cart = get_or_create_user_cart(db, current_user.id)

    # Block duplicate
    existing_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.lab_id == data.lab_id
    ).first()
    if existing_item:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{data.lab_title}' is already in your cart."
        )

    # Resolve the SysAdmin fixed_rate for this lab
    rate = get_sysadmin_rate(db, data.lab_id)
    hours = data.hours_purchased or 1

    new_item = CartItem(
        cart_id=cart.id,
        lab_id=data.lab_id,
        lab_title=data.lab_title,
        lab_image=data.lab_image,
        price_inr=rate * hours,
        quantity=1,
        license_duration_months=12,
        hours_purchased=hours
    )
    db.add(new_item)
    db.commit()
    logger.info(f"[Cart] User {current_user.email} added lab '{data.lab_id}' at ₹{rate}/hr for {hours}hr(s).")
    return {"status": "success", "message": f"Added '{data.lab_title}' to cart.", "rate": rate}

@router.put("/items/{item_id}")
def update_cart_item(
    item_id: int,
    data: UpdateCartItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates hours purchased for a specific cart item.
    Recalculates price using SysAdmin's fixed_rate.
    """
    cart = get_or_create_user_cart(db, current_user.id)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found.")

    if data.hours_purchased is not None and data.hours_purchased > 0:
        item.hours_purchased = data.hours_purchased
        # Recalculate using the SysAdmin fixed_rate
        rate = get_sysadmin_rate(db, item.lab_id)
        item.price_inr = rate * data.hours_purchased

    db.commit()
    return {"status": "success", "message": "Cart item updated."}

@router.delete("/items/{item_id}")
def remove_cart_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Removes a single item from the cart.
    """
    cart = get_or_create_user_cart(db, current_user.id)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if item:
        db.delete(item)
        db.commit()

    return {"status": "success", "message": "Item removed from cart."}

@router.delete("")
def clear_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Clears all items in the user's cart.
    """
    cart = get_or_create_user_cart(db, current_user.id)
    db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
    db.commit()
    return {"status": "success", "message": "Cart cleared."}
