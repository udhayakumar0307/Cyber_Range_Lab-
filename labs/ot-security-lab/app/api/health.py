from fastapi import APIRouter
import os

router = APIRouter()


@router.get("/health")
def health():

    database_exists = os.path.exists(
        os.getenv("DATABASE_PATH", "ot_simulator.db")
    )

    upload_exists = os.path.exists(
        os.getenv("UPLOAD_DIR", "uploads")
    )

    report_exists = os.path.exists(
        os.getenv("REPORT_DIR", "reports")
    )

    return {
        "status": "ok",
        "database": database_exists,
        "uploads": upload_exists,
        "reports": report_exists,
    }
