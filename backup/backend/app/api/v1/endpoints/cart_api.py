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
    price_inr: float
    quantity: int = 1  # Student seats
    license_duration_months: int = 12

class UpdateCartItemRequest(BaseModel):
    quantity: Optional[int] = None
    license_duration_months: Optional[int] = None

def get_or_create_user_cart(db: Session, user_id: int) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart

@router.get("")
def get_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns the user's current active shopping cart.
    """
    cart = get_or_create_user_cart(db, current_user.id)
    items = []
    subtotal = 0.0

    for item in cart.items:
        item_total = item.price_inr * item.quantity
        subtotal += item_total
        items.append({
            "id": item.id,
            "lab_id": item.lab_id,
            "lab_title": item.lab_title,
            "lab_image": item.lab_image or "",
            "price_inr": item.price_inr,
            "quantity": item.quantity,
            "license_duration_months": item.license_duration_months,
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
    Adds a lab item to the user's cart or updates quantity if already present.
    """
    cart = get_or_create_user_cart(db, current_user.id)
    
    # Check if item already in cart
    existing_item = db.query(CartItem).filter(CartItem.cart_id == cart.id, CartItem.lab_id == data.lab_id).first()
    if existing_item:
        existing_item.quantity += data.quantity
        existing_item.license_duration_months = data.license_duration_months
    else:
        new_item = CartItem(
            cart_id=cart.id,
            lab_id=data.lab_id,
            lab_title=data.lab_title,
            lab_image=data.lab_image,
            price_inr=data.price_inr,
            quantity=data.quantity,
            license_duration_months=data.license_duration_months
        )
        db.add(new_item)

    db.commit()
    return {"status": "success", "message": f"Added '{data.lab_title}' to cart."}

@router.put("/items/{item_id}")
def update_cart_item(
    item_id: int,
    data: UpdateCartItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates seat quantity or duration for a specific cart item.
    """
    cart = get_or_create_user_cart(db, current_user.id)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found.")

    if data.quantity is not None and data.quantity > 0:
        item.quantity = data.quantity
    if data.license_duration_months is not None:
        item.license_duration_months = data.license_duration_months

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
