from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from app.database.manager import db_manager

router = APIRouter()

@router.get("/health")
def health_check():
    """
    Checks the connectivity of the database manager and determines dialect type.
    """
    db_connected = db_manager.check_health()
    db_type = "unknown"
    if db_manager.engine:
        db_type = db_manager.engine.dialect.name  # Returns "postgresql" or "sqlite" dynamically
        
    if db_connected:
        return {
            "status": "ok",
            "database": db_type,
            "connected": True
        }
    else:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "database": db_type,
                "connected": False
            }
        )
