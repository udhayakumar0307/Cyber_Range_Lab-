from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    institution_type = Column(String(100), nullable=False)  # College, University, School, Training Center, Company, Government, Research Organization
    address = Column(Text, nullable=True)
    country = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    gst_number = Column(String(50), nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def organization_name(self) -> str:
        return self.name or ""

    @organization_name.setter
    def organization_name(self, value: str):
        self.name = value

class AdminProfile(Base):
    __tablename__ = "admin_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    phone = Column(String(50), nullable=True)
    designation = Column(String(100), default="Administrator")
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization")
    user = relationship("User")

class Cart(Base):
    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    cart_id = Column(Integer, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    lab_id = Column(String(100), nullable=False)
    lab_title = Column(String(200), nullable=False)
    lab_image = Column(String(500), nullable=True)
    price_inr = Column(Float, nullable=False, default=0.0)
    quantity = Column(Integer, nullable=False, default=1)  # Student seats count
    license_duration_months = Column(Integer, default=12)
    hours_purchased = Column(Float, default=40.0, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cart = relationship("Cart", back_populates="items")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(100), unique=True, nullable=False, index=True)
    razorpay_order_id = Column(String(150), unique=True, nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    institution_name = Column(String(200), nullable=True)
    subtotal = Column(Float, nullable=False, default=0.0)
    tax = Column(Float, nullable=False, default=0.0)
    discount = Column(Float, nullable=False, default=0.0)
    grand_total = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), default="PENDING")  # PENDING, COMPLETED, FAILED
    payment_status = Column(String(50), default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    lab_id = Column(String(100), nullable=False)
    lab_title = Column(String(200), nullable=False)
    seats = Column(Integer, default=1)
    duration_months = Column(Integer, default=12)
    price = Column(Float, default=0.0)
    hours_purchased = Column(Float, default=40.0, nullable=True)

    order = relationship("Order", back_populates="items")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(String(150), unique=True, nullable=False, index=True)
    payment_status = Column(String(50), default="SUCCESS")  # SUCCESS, FAILED, PENDING
    gateway = Column(String(50), default="razorpay")  # razorpay, stripe, cashfree, mock
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    method = Column(String(50), default="UPI / Card")
    created_at = Column(DateTime, default=datetime.utcnow)

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), unique=True, nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    billing_address_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PurchasedLab(Base):
    __tablename__ = "purchased_labs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    lab_id = Column(String(100), nullable=False)
    lab_title = Column(String(200), nullable=False)
    license_key = Column(String(100), unique=True, nullable=False)
    total_seats = Column(Integer, default=1)
    assigned_seats = Column(Integer, default=0)
    status = Column(String(50), default="ACTIVE")  # ACTIVE, EXPIRED, SUSPENDED
    purchased_date = Column(DateTime, default=datetime.utcnow)
    expiry_date = Column(DateTime, nullable=False)
    
    # Hourly rentals
    hours_purchased = Column(Float, default=0.0, nullable=True)
    hours_used = Column(Float, default=0.0, nullable=True)
    hours_remaining = Column(Float, default=0.0, nullable=True)
    assigned_to = Column(String(50), default="both", nullable=True)
    fixed_rate = Column(Float, default=0.0, nullable=True)


class License(Base):
    __tablename__ = "licenses"

    id = Column(Integer, primary_key=True, index=True)
    purchased_lab_id = Column(Integer, ForeignKey("purchased_labs.id", ondelete="CASCADE"), nullable=False)
    license_key = Column(String(100), unique=True, nullable=False)
    allocated_user_email = Column(String(150), nullable=True)
    status = Column(String(50), default="AVAILABLE")  # AVAILABLE, ASSIGNED, REVOKED
    expiry_date = Column(DateTime, nullable=False)
    hours_allocated = Column(Float, default=1.0, nullable=True)
    hours_used = Column(Float, default=0.0, nullable=True)

class BillingAddress(Base):
    __tablename__ = "billing_addresses"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    address_line = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    pincode = Column(String(20), nullable=False)
    gst_number = Column(String(50), nullable=True)

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    plan_name = Column(String(100), default="Enterprise Tier")
    status = Column(String(50), default="ACTIVE")
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=False)

class OrganizationApiKey(Base):
    __tablename__ = "organization_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    api_key = Column(String(150), unique=True, nullable=False, index=True)
    status = Column(String(50), default="ACTIVE")  # ACTIVE, DISABLED, REVOKED
    created_at = Column(DateTime, default=datetime.utcnow)

