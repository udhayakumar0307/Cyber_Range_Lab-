from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.cache.cache_manager import cache_manager
from app.integrations.integration_manager import integration_manager

router = APIRouter()

@router.get("/consents")
async def get_consents():
    # Make it always load through integration_manager which manages local DB cache
    data = await integration_manager.fetch_and_normalize_customers()
    cache_manager.set("consents", data)
    return data

@router.put("/consents/{id}/approve")
def approve_consent(id: str, db: Session = Depends(get_db)):
    try:
        try:
            db.execute(
                text("UPDATE customer_address SET consent_status = 'granted' WHERE customer_id = :id"),
                {"id": int(id) if id.isdigit() else id}
            )
        except Exception:
            pass
            
        db.execute(
            text("UPDATE cms_consent_records SET consent_status = 'Approved' WHERE customer_id = :id"),
            {"id": id}
        )
        
        db.execute(
            text("INSERT INTO cms_audit_log (event_type, description) VALUES ('Consent Approved', :desc)"),
            {"desc": f"Customer {id} granted data processing consent."}
        )
        db.commit()
        cache_manager.invalidate_all()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/consents/{id}/revoke")
def revoke_consent(id: str, db: Session = Depends(get_db)):
    try:
        try:
            db.execute(
                text("UPDATE customer_address SET consent_status = 'revoked' WHERE customer_id = :id"),
                {"id": int(id) if id.isdigit() else id}
            )
        except Exception:
            pass
            
        db.execute(
            text("UPDATE cms_consent_records SET consent_status = 'Revoked' WHERE customer_id = :id"),
            {"id": id}
        )
        
        db.execute(
            text("INSERT INTO cms_audit_log (event_type, description) VALUES ('Consent Revoked', :desc)"),
            {"desc": f"Customer {id} withdrew data processing consent."}
        )
        db.commit()
        cache_manager.invalidate_all()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
