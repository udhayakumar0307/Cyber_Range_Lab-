from fastapi import APIRouter
from app.api.v1.endpoints import auth, health, reporting, user_profile, admin_api, cart_api, payment_api, labs_api, system_audit_api, notifications_api, cll_api, crypto_api, cloud_api, recon_api, terminal_api, techcorp_api, colleges_orgs

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(colleges_orgs.router, prefix="", tags=["affiliations"])
api_router.include_router(reporting.router, prefix="/reporting", tags=["reporting"])
api_router.include_router(user_profile.router, prefix="/user", tags=["user"])
api_router.include_router(admin_api.router, prefix="/admin", tags=["admin"])
api_router.include_router(cart_api.router, prefix="/cart", tags=["cart"])
api_router.include_router(payment_api.router, tags=["payment"])
api_router.include_router(labs_api.router, prefix="/labs", tags=["labs"])
api_router.include_router(techcorp_api.router, prefix="/labs/techcorp", tags=["techcorp"])
api_router.include_router(cll_api.router, prefix="/cll", tags=["cll"])
api_router.include_router(crypto_api.router, prefix="/crypto", tags=["crypto"])
api_router.include_router(cloud_api.router, prefix="/cloud", tags=["cloud"])
api_router.include_router(recon_api.router, prefix="/recon", tags=["recon"])
api_router.include_router(notifications_api.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(system_audit_api.router, prefix="/system", tags=["system"])
api_router.include_router(terminal_api.router, prefix="/terminal", tags=["terminal"])



