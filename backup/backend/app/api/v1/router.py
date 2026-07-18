from fastapi import APIRouter
from app.api.v1.endpoints import auth, health, reporting, user_profile

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(reporting.router, prefix="/reporting", tags=["reporting"])
api_router.include_router(user_profile.router, prefix="/user", tags=["user"])


