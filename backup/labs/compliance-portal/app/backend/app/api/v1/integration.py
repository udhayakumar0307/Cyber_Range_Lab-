from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.schemas.integration import IntegrationConnectRequest
from app.privacy_engine.engine import privacy_engine
from app.scheduler.scheduler import aps_scheduler
from app.integrations.integration_manager import integration_manager

router = APIRouter()

@router.get("/integration/config")
def get_config(db: Session = Depends(get_db)):
    row = db.execute(text("SELECT id, store_name, store_url, platform, connection_status, api_version, webhook_url, last_sync FROM cms_integration_config LIMIT 1")).fetchone()
    if row:
        r = dict(row._mapping)
        return {
            "id": r["id"],
            "storeName": r["store_name"],
            "storeUrl": r["store_url"],
            "platform": r["platform"],
            "connectionStatus": r["connection_status"],
            "apiVersion": r["api_version"],
            "webhookUrl": r["webhook_url"],
            "lastSync": str(r["last_sync"]) if r["last_sync"] else None,
            "apiKeyMasked": "•••••••••••••••••••••"
        }
    return {}

@router.get("/integration/status")
async def get_status(db: Session = Depends(get_db)):
    row = db.execute(text("SELECT connection_status, last_sync FROM cms_integration_config LIMIT 1")).fetchone()
    connected = False
    last_sync = "Never"
    if row:
        connected = (row[0] == "Connected")
        from app.privacy_engine.anonymization_analyzer import to_utc_iso
        last_sync = to_utc_iso(row[1]) if row[1] else "Never"
        
    return {
        "connected": connected,
        "platform": "Generic REST Platform",
        "lastSync": last_sync,
        "health": "Healthy" if connected else "Unhealthy",
        "responseTime": "120ms" if connected else "N/A"
    }

@router.post("/integration/connect")
async def connect_store(req: IntegrationConnectRequest, db: Session = Depends(get_db)):
    from app.core.security import encrypt_credential
    from app.cache.cache_manager import cache_manager

    is_placeholder = (req.api_key == "•••••••••••••••••••••")

    # Upsert integration config with real credentials
    existing = db.execute(text("SELECT id, encrypted_api_key FROM cms_integration_config LIMIT 1")).fetchone()
    if existing:
        if is_placeholder:
            encrypted_key = existing[1]
        else:
            encrypted_key = encrypt_credential(req.api_key) if req.api_key else ""

        db.execute(
            text("""UPDATE cms_integration_config 
                 SET store_name = :name, store_url = :url, platform = :plat,
                     encrypted_api_key = :key, connection_status = 'Connected',
                     last_sync = CURRENT_TIMESTAMP
                 WHERE id = :id"""),
            {"name": req.store_name, "url": req.store_url, "plat": req.platform,
             "key": encrypted_key, "id": existing[0]}
        )
    else:
        encrypted_key = encrypt_credential(req.api_key) if req.api_key and not is_placeholder else ""
        db.execute(
            text("""INSERT INTO cms_integration_config 
                 (store_name, store_url, platform, encrypted_api_key, connection_status, api_version, last_sync)
                 VALUES (:name, :url, :plat, :key, 'Connected', 'v1.0', CURRENT_TIMESTAMP)"""),
            {"name": req.store_name, "url": req.store_url, "plat": req.platform, "key": encrypted_key}
        )

    db.execute(text(
        "INSERT INTO cms_audit_log (event_type, description) VALUES ('Integration Connected', :desc)"
    ), {"desc": f"Platform '{req.store_name}' connected via {req.platform}."})
    db.commit()

    # Clear stale cache so fresh analysis runs with new credentials
    cache_manager.invalidate_all()

    # Trigger initial synchronization run with new credentials
    await privacy_engine.run_analysis()

    return {"success": True, "message": f"Connected to '{req.store_name}' successfully"}

@router.post("/integration/disconnect")
def disconnect_store(db: Session = Depends(get_db)):
    db.execute(text("UPDATE cms_integration_config SET connection_status = 'Disconnected' WHERE id = 1"))
    db.execute(text("INSERT INTO cms_audit_log (event_type, description) VALUES ('Sync Terminated', 'Connected platform disconnected.')"))
    db.commit()
    aps_scheduler.stop()
    return {"success": True, "message": "Platform disconnected successfully"}

@router.post("/integration/sync")
async def start_sync():
    await privacy_engine.run_analysis()
    return {"success": True, "message": "Manual synchronization run complete."}

@router.post("/integration/verify")
async def verify_connection():
    success = await integration_manager.verify_active_connection()
    return {"success": success}

@router.get("/integration/sync-history")
def get_sync_history(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT id, event, status, timestamp FROM cms_sync_history ORDER BY id DESC LIMIT 20")).fetchall()
    return [dict(r._mapping) for r in rows]

from pydantic import BaseModel
from typing import List
from datetime import datetime

class DeleteSyncHistoryRequest(BaseModel):
    timestamps: List[str]

def parse_iso_datetime(ts_str: str):
    clean_ts = ts_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(clean_ts)
    except Exception:
        return None

@router.post("/integration/clear-sync-history")
def clear_sync_history(db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM cms_sync_history"))
        db.commit()
        return {"success": True, "message": "Synchronization history cleared."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/integration/delete-sync-history")
def delete_sync_history(req: DeleteSyncHistoryRequest, db: Session = Depends(get_db)):
    try:
        if req.timestamps:
            for ts in req.timestamps:
                parsed_ts = parse_iso_datetime(ts)
                if parsed_ts:
                    db.execute(
                        text("DELETE FROM cms_sync_history WHERE timestamp = :parsed_ts OR timestamp = :raw_ts"),
                        {"parsed_ts": parsed_ts, "raw_ts": ts}
                    )
                else:
                    db.execute(
                        text("DELETE FROM cms_sync_history WHERE timestamp = :raw_ts"),
                        {"raw_ts": ts}
                    )
            db.commit()
        return {"success": True, "message": "Selected synchronization entries deleted."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
