import logging
import json
import hmac
import hashlib
from uuid import uuid4, UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import httpx

from backend.pg import get_pg
from backend.dependencies.auth import get_current_user
from backend.dependencies.authz import SysAdminOnly, AnyAuthenticatedUser
from backend.schemas.auth import CurrentUser
from backend.config import get_settings

log = logging.getLogger("billing")
router = APIRouter(prefix="/billing", tags=["Billing & Pricing"])


# ── Pydantic Request/Response Models ──────────────────────────────────────────

class PriceUpdateRequest(BaseModel):
    amount_minor: int = Field(..., ge=0, description="Price in cents/minor units")
    currency: str = Field("INR", min_length=3, max_length=3)
    is_active: bool = True


class ManualGrantRequest(BaseModel):
    user_id: UUID
    content_id: UUID


class CheckoutOrderRequest(BaseModel):
    content_id: UUID
    user_id: Optional[UUID] = None


class VerifyCaptureRequest(BaseModel):
    razorpay_order_id: str = Field(..., min_length=5)
    razorpay_payment_id: str = Field(..., min_length=5)
    razorpay_signature: str = Field(..., min_length=5)
    user_id: Optional[UUID] = None


# ── Course Pricing Endpoints ───────────────────────────────────────────────

@router.get("/admin/courses/{content_id}/price")
async def get_course_price(
    content_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Fetches pricing details for a lab scenario/course."""
    result = await pg.execute(
        text("""
            SELECT content_id, amount_minor, currency, is_active 
            FROM content_prices 
            WHERE content_id = :content_id
        """),
        {"content_id": content_id},
    )
    row = result.fetchone()
    if not row:
        return {
            "success": True,
            "data": {
                "content_id": str(content_id),
                "price": None
            }
        }
        
    return {
        "success": True,
        "data": {
            "content_id": str(row.content_id),
            "price": {
                "amount_minor": row.amount_minor,
                "currency": row.currency,
                "is_active": row.is_active
            }
        }
    }


@router.put("/admin/courses/{content_id}/price")
async def update_course_price(
    payload: PriceUpdateRequest,
    content_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Configures/upserts price details for a lab scenario/course."""
    await pg.execute(
        text("""
            INSERT INTO content_prices (content_id, amount_minor, currency, is_active, updated_at)
            VALUES (:content_id, :amount, :currency, :is_active, now())
            ON CONFLICT (content_id) DO UPDATE SET
                amount_minor = EXCLUDED.amount_minor,
                currency = EXCLUDED.currency,
                is_active = EXCLUDED.is_active,
                updated_at = now()
        """),
        {
            "content_id": content_id,
            "amount": payload.amount_minor,
            "currency": payload.currency,
            "is_active": payload.is_active,
        }
    )
    await pg.commit()
    
    return {
        "success": True,
        "data": {
            "content_id": str(content_id),
            "amount_minor": payload.amount_minor,
            "currency": payload.currency,
            "is_active": payload.is_active
        }
    }


# ── Payment Logs & Entitlements Admin ──────────────────────────────────────────

@router.get("/admin/payments")
async def list_payments_admin(
    status: Optional[str] = Query(None),
    user_id: Optional[UUID] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Lists payment records with joined purchase and entitlement data."""
    result = await pg.execute(
        text("""
            SELECT 
                p.id AS payment_id,
                p.user_id,
                u.email,
                p.gateway,
                p.gateway_order_id,
                p.gateway_payment_id,
                p.amount AS amount_minor,
                p.currency,
                p.status,
                p.created_at,
                COALESCE(pur.content_id, (p.raw_response->>'content_id')::uuid) AS content_id,
                ci.title AS content_title,
                CASE WHEN pur.id IS NOT NULL THEN TRUE ELSE FALSE END AS purchase_exists,
                ent.status AS entitlement_status
            FROM payments p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN purchases pur ON pur.payment_id = p.id
            LEFT JOIN content_items ci ON ci.id = COALESCE(pur.content_id, (p.raw_response->>'content_id')::uuid)
            LEFT JOIN entitlements ent ON ent.user_id = p.user_id AND ent.content_id = COALESCE(pur.content_id, (p.raw_response->>'content_id')::uuid)
            WHERE (:status IS NULL OR p.status = :status)
              AND (:user_id IS NULL OR p.user_id = :user_id)
            ORDER BY p.created_at DESC
            LIMIT :limit
        """),
        {
            "status": status,
            "user_id": user_id,
            "limit": limit
        }
    )
    rows = result.fetchall()
    return {
        "success": True,
        "data": {
            "rows": [
                {
                    "payment_id": str(r.payment_id),
                    "user_id": str(r.user_id),
                    "email": r.email,
                    "gateway": r.gateway,
                    "gateway_order_id": r.gateway_order_id,
                    "gateway_payment_id": r.gateway_payment_id,
                    "amount": float(r.amount_minor) / 100.0,
                    "currency": r.currency,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "content_id": str(r.content_id) if r.content_id else None,
                    "content_title": r.content_title,
                    "purchase_exists": r.purchase_exists,
                    "entitlement_status": r.entitlement_status,
                    "webhook_seen": False
                }
                for r in rows
            ]
        }
    }


@router.post("/admin/grant-entitlement")
async def grant_manual_entitlement(
    payload: ManualGrantRequest,
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Manually grants course entitlements to users."""
    await pg.execute(
        text("""
            INSERT INTO entitlements (user_id, content_id, valid_from, status)
            VALUES (:user_id, :content_id, now(), 'active')
            ON CONFLICT (user_id, content_id) DO UPDATE SET
                status = 'active',
                valid_from = now(),
                valid_until = NULL
        """),
        {"user_id": payload.user_id, "content_id": payload.content_id}
    )
    await pg.commit()
    return {
        "success": True,
        "message": "Manual entitlement granted successfully"
    }


# ── Participant Checkout & Payments ──────────────────────────────────────────

@router.get("/entitlements")
async def list_my_entitlements(
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """Retrieves all active entitlements for the current calling participant."""
    result = await pg.execute(
        text("""
            SELECT content_id, status, valid_from, valid_until
            FROM entitlements
            WHERE user_id = :user_id
        """),
        {"user_id": current_user.id}
    )
    rows = result.fetchall()
    return [
        {
            "content_id": str(r.content_id),
            "status": r.status,
            "valid_from": r.valid_from.isoformat() if r.valid_from else None,
            "valid_until": r.valid_until.isoformat() if r.valid_until else None,
        }
        for r in rows
    ]


@router.post("/orders")
async def create_checkout_order(
    payload: CheckoutOrderRequest,
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """
    Creates a new checkout payment record.
    If user_id is supplied and the caller is sys_admin, purchases on behalf of that student.
    """
    target_user_id = current_user.id
    if payload.user_id is not None:
        if current_user.role == "sys_admin":
            target_user_id = payload.user_id
        else:
            raise HTTPException(status_code=403, detail="Only sys_admin can purchase on behalf of another user.")

    # 1. Fetch course price
    price_result = await pg.execute(
        text("SELECT amount_minor, currency, is_active FROM content_prices WHERE content_id = :cid"),
        {"cid": payload.content_id}
    )
    price = price_result.fetchone()
    if not price or not price.is_active:
        raise HTTPException(
            status_code=400, 
            detail="This course is currently not available for purchase."
        )

    # 2. Generate unique order ID
    order_id = f"order_{uuid4().hex[:14]}"

    # 3. Store order details in database
    await pg.execute(
        text("""
            INSERT INTO payments (
                id, user_id, gateway, gateway_order_id, amount, currency, status, raw_response
            ) VALUES (
                gen_random_uuid(), :user_id, 'razorpay', :order_id, :amount, :currency, 'created', :raw_resp
            )
        """),
        {
            "user_id": target_user_id,
            "order_id": order_id,
            "amount": price.amount_minor,
            "currency": price.currency,
            "raw_resp": json.dumps({"content_id": str(payload.content_id)})
        }
    )
    await pg.commit()

    return {
        "success": True,
        "data": {
            "razorpay_order_id": order_id,
            "amount_minor": price.amount_minor,
            "currency": price.currency,
            "razorpay_key_id": "rzp_test_mock_key"
        }
    }


@router.post("/verify-capture")
async def verify_and_capture_payment(
    payload: VerifyCaptureRequest,
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """
    Verifies payment signature, re-fetches payment from Razorpay gateway,
    validates ownership, and grants final course entitlement upon verification.
    """
    settings = get_settings()

    # 0. Ensure Razorpay credentials are configured
    if not settings.RAZORPAY_KEY_SECRET or not settings.RAZORPAY_KEY_ID:
        raise HTTPException(
            status_code=503,
            detail="Payment gateway not configured",
        )

    target_user_id = current_user.id
    if payload.user_id is not None:
        if current_user.role == "sys_admin":
            target_user_id = payload.user_id
        else:
            raise HTTPException(status_code=403, detail="Only sys_admin can process capture on behalf of another user.")

    # 1. Find payment record
    payment_result = await pg.execute(
        text("SELECT id, user_id, amount, currency, status, raw_response FROM payments WHERE gateway_order_id = :order_id"),
        {"order_id": payload.razorpay_order_id}
    )
    payment = payment_result.fetchone()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    if payment.status == "captured":
        return {
            "success": True,
            "data": {
                "status": "fulfilled",
                "message": "Payment was already captured and entitlement granted."
            }
        }

    # 2. Verify payment ownership
    if str(payment.user_id) != str(target_user_id):
        raise HTTPException(
            status_code=403,
            detail="This payment does not belong to the target user.",
        )

    # 3. HMAC-SHA256 signature verification (constant-time comparison)
    expected_signature = hmac.new(
        key=settings.RAZORPAY_KEY_SECRET.encode(),
        msg=f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
        log.warning(
            "Invalid Razorpay signature for order_id=%s payment_id=%s user_id=%s",
            payload.razorpay_order_id, payload.razorpay_payment_id, target_user_id,
        )
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # 4. Server-side re-fetch from Razorpay API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            rz_response = await client.get(
                f"https://api.razorpay.com/v1/payments/{payload.razorpay_payment_id}",
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            )
            rz_response.raise_for_status()
            rz_data = rz_response.json()
    except httpx.TimeoutException:
        log.error(
            "Razorpay API timeout verifying payment_id=%s order_id=%s",
            payload.razorpay_payment_id, payload.razorpay_order_id,
        )
        raise HTTPException(
            status_code=502,
            detail="Payment gateway verification timed out. Please retry.",
        )
    except Exception as exc:
        log.error(
            "Razorpay API error verifying payment_id=%s: %s",
            payload.razorpay_payment_id, exc,
        )
        raise HTTPException(
            status_code=502,
            detail="Unable to verify payment with gateway",
        )

    # 5. Validate Razorpay response fields
    rz_status = rz_data.get("status", "")
    if rz_status not in ("captured", "authorized"):
        raise HTTPException(
            status_code=400,
            detail=f"Payment has not been captured at gateway. Gateway status: {rz_status}",
        )

    rz_amount = rz_data.get("amount")
    if rz_amount is not None and int(rz_amount) != int(payment.amount):
        raise HTTPException(
            status_code=400,
            detail="Payment amount mismatch between gateway and local record.",
        )

    rz_order_id = rz_data.get("order_id", "")
    if rz_order_id and rz_order_id != payload.razorpay_order_id:
        raise HTTPException(
            status_code=400,
            detail="Order ID mismatch between gateway response and request.",
        )

    # 6. Extract content_id from raw_response
    try:
        raw_resp = payment.raw_response or {}
        if isinstance(raw_resp, str):
            raw_resp = json.loads(raw_resp)
        content_id_str = raw_resp.get("content_id")
        if not content_id_str:
            raise ValueError
        content_id = UUID(content_id_str)
    except Exception:
        raise HTTPException(
            status_code=500, 
            detail="Payment record is missing associated content_id in raw_response tracking."
        )

    # 7. Update payment status to captured
    await pg.execute(
        text("""
            UPDATE payments 
            SET status = 'captured', gateway_payment_id = :pay_id, updated_at = now()
            WHERE id = :id
        """),
        {"pay_id": payload.razorpay_payment_id, "id": payment.id}
    )

    # 8. Insert purchase log
    await pg.execute(
        text("""
            INSERT INTO purchases (user_id, content_id, payment_id)
            VALUES (:user_id, :content_id, :payment_id)
            ON CONFLICT (user_id, content_id) DO NOTHING
        """),
        {"user_id": target_user_id, "content_id": content_id, "payment_id": payment.id}
    )

    # 9. Insert/upsert entitlement record
    await pg.execute(
        text("""
            INSERT INTO entitlements (user_id, content_id, valid_from, status)
            VALUES (:user_id, :content_id, now(), 'active')
            ON CONFLICT (user_id, content_id) DO UPDATE SET
                status = 'active',
                valid_from = now(),
                valid_until = NULL
        """),
        {"user_id": target_user_id, "content_id": content_id}
    )

    await pg.commit()

    log.info("Payment captured and course entitlement granted: order_id=%s payment_id=%s user_id=%s content_id=%s", 
             payload.razorpay_order_id, payload.razorpay_payment_id, target_user_id, content_id)

    return {
        "success": True,
        "data": {
            "status": "fulfilled",
            "message": "Payment verified and entitlement granted successfully"
        }
    }

