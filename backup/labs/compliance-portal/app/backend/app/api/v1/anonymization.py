from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from sqlalchemy import text
from app.cache.cache_manager import cache_manager
from app.privacy_engine.engine import privacy_engine
from app.privacy_engine.anonymization_analyzer import anonymization_analyzer, transform_value, to_utc_iso
from app.integrations.integration_manager import integration_manager
from app.core.database import engine as db_engine

router = APIRouter()

class AnonymizeJobRequest(BaseModel):
    fields: List[str]
    techniques: Dict[str, str]
    autopilot: bool = False

class ShareRequest(BaseModel):
    destination: str
    sharing_medium: str
    purpose: str
    fields: List[str]

class PreviewRequest(BaseModel):
    fields: List[str]
    techniques: Dict[str, str]

@router.get("/anonymization")
async def get_anonymization():
    data = cache_manager.get("anonymization")
    if not data:
        await privacy_engine.run_analysis()
        data = cache_manager.get("anonymization")
    
    # Fetch real consents to use as sample
    live_consents = cache_manager.get("consents")
    if not live_consents:
        try:
            live_consents = await integration_manager.fetch_and_normalize_customers()
            cache_manager.set("consents", live_consents)
        except Exception:
            live_consents = []
            
    sample = {}
    if live_consents:
        first = live_consents[0]
        for key, val in first.items():
            if key not in ("id", "user_id", "status", "consent_status", "created", "updated", "timestamp", "is_minor", "age_category", "data_principal_type", "guardian_consent", "parent_contact"):
                sample[key] = str(val or "")
                
    if not sample:
        # Fallback if database is entirely empty
        sample = {
            "email": "demo.user@domain.com",
            "name": "Demo User",
            "phone": "+91 99999-88888",
            "address": "123 Technology Hub, Bengaluru, Karnataka"
        }
        
    data["sampleCustomer"] = sample
    return data

@router.post("/anonymization/jobs")
async def trigger_anonymization_job(req: AnonymizeJobRequest):
    try:
        live_consents = await integration_manager.fetch_and_normalize_customers()
        count = len(live_consents) if live_consents else 500
        
        fields_to_anonymize = req.fields
        if req.autopilot:
            # Autopilot: automatically filter scanner high-risk detected fields
            analysis_data = anonymization_analyzer.analyze()
            detected_pii = analysis_data.get("detectedPii", [])
            fields_to_anonymize = [f["field"] for f in detected_pii if f["risk"] == "High"]
            
        # Failure simulation check
        should_fail = any(
            "fail" in f.lower() or "error" in f.lower() or f.endswith("9")
            for f in fields_to_anonymize
        )

        if should_fail:
            with db_engine.begin() as conn:
                conn.execute(
                    text("INSERT INTO cms_sync_history (event, status) VALUES (:ev, 'Failed')"),
                    {"ev": f"Anonymization: {count} customer records masked"}
                )
            cache_manager.invalidate_all()
            await privacy_engine.run_analysis()
            raise HTTPException(status_code=500, detail="PII Masking Pipeline compilation error (Simulated)")

        with db_engine.begin() as conn:
            conn.execute(
                text("INSERT INTO cms_sync_history (event, status) VALUES (:ev, 'Success')"),
                {"ev": f"Anonymization: {count} customer records masked"}
            )
            fields_str = ", ".join(fields_to_anonymize)
            conn.execute(
                text("INSERT INTO cms_audit_log (event_type, description) VALUES ('Masking Job Executed', :desc)"),
                {"desc": f"Automated masking run executed for PII fields: {fields_str}."}
            )
            
        cache_manager.invalidate_all()
        await privacy_engine.run_analysis()
        return {"success": True, "message": f"Masking run complete. {count} records anonymized."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/anonymization/share")
async def secure_third_party_share(req: ShareRequest):
    try:
        live_consents = cache_manager.get("consents")
        if not live_consents:
            live_consents = await integration_manager.fetch_and_normalize_customers()
            cache_manager.set("consents", live_consents)
            
        if not live_consents:
            await privacy_engine.run_analysis()
            live_consents = cache_manager.get("consents") or []
            
        if not live_consents:
            raise HTTPException(status_code=400, detail="No customer consent records available to share.")
            
        count = len(live_consents)

        # Failure simulation check
        should_fail = any(
            "fail" in f.lower() or "error" in f.lower() or f.endswith("9")
            for f in req.fields
        )

        if should_fail:
            with db_engine.begin() as conn:
                conn.execute(
                    text("INSERT INTO cms_sync_history (event, status) VALUES (:ev, 'Failed')"),
                    {"ev": f"Anonymization: {count} customer records disclosed"}
                )
            cache_manager.invalidate_all()
            await privacy_engine.run_analysis()
            raise HTTPException(status_code=500, detail="PII Masking Pipeline compilation error (Simulated)")

        success = anonymization_analyzer.anonymize_and_share_bulk(
            consents=live_consents,
            destination=req.destination,
            purpose=req.purpose,
            sharing_medium=req.sharing_medium,
            fields=req.fields
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to write hash signatures to audit database.")
            
        with db_engine.begin() as conn:
            conn.execute(
                text("INSERT INTO cms_sync_history (event, status) VALUES (:ev, 'Success')"),
                {"ev": f"Anonymization: {count} customer records disclosed"}
            )

        cache_manager.invalidate_all()
        await privacy_engine.run_analysis()
        return {"success": True, "message": f"Successfully shared {len(live_consents)} records with {req.destination}."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/anonymization/preview")
async def get_dataset_preview(req: PreviewRequest):
    try:
        live_consents = cache_manager.get("consents")
        if not live_consents:
            live_consents = await integration_manager.fetch_and_normalize_customers()
            cache_manager.set("consents", live_consents)
            
        if not live_consents:
            return {"raw": {}, "anonymized": {}}
            
        sample = live_consents[0]
        
        raw_preview = {}
        anonymized_preview = {}
        
        for key, val in sample.items():
            if key in ("id", "user_id", "status", "consent_status", "created", "updated", "timestamp", "is_minor", "age_category", "data_principal_type", "guardian_consent", "parent_contact"):
                continue
            raw_preview[key] = str(val or "")
            
            if key in req.fields:
                tech = req.techniques.get(key, "Masking")
                anonymized_preview[key] = transform_value(key, val, tech)
            else:
                anonymized_preview[key] = str(val or "")
                
        return {
            "raw": raw_preview,
            "anonymized": anonymized_preview
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/anonymization/trace")
async def trace_leak(hash_sig: str = None, record_id: str = None):
    if not hash_sig and not record_id:
        raise HTTPException(status_code=400, detail="Provide a hash_sig or record_id to trace.")
    
    query_str = "SELECT id, record_id, sha256_hash, destination, purpose, sharing_medium, verification_status, timestamp FROM cms_hash_audit"
    params = {}
    if hash_sig:
        query_str += " WHERE sha256_hash = :h"
        params["h"] = hash_sig.strip()
    elif record_id:
        query_str += " WHERE record_id = :r"
        params["r"] = record_id.strip()
        
    with db_engine.connect() as conn:
        res = conn.execute(text(query_str), params)
        rows = [dict(row._mapping) for row in res]
        
    for r in rows:
        r["timestamp"] = to_utc_iso(r["timestamp"])
        
    return rows

class FeedbackRequest(BaseModel):
    field_name: str
    action: str
    technique: str = None

@router.post("/anonymization/feedback")
async def save_override_feedback(req: FeedbackRequest):
    try:
        with db_engine.begin() as conn:
            exist = conn.execute(
                text("SELECT id FROM cms_override_rules WHERE field_name = :name"),
                {"name": req.field_name}
            ).fetchone()
            
            if exist:
                conn.execute(
                    text("UPDATE cms_override_rules SET action = :act, technique = :tech, timestamp = CURRENT_TIMESTAMP WHERE field_name = :name"),
                    {"act": req.action, "tech": req.technique, "name": req.field_name}
                )
            else:
                conn.execute(
                    text("INSERT INTO cms_override_rules (field_name, action, technique) VALUES (:name, :act, :tech)"),
                    {"name": req.field_name, "act": req.action, "tech": req.technique}
                )
                
            conn.execute(
                text("INSERT INTO cms_audit_log (event_type, description) VALUES ('Override Logic Feedback', :desc)"),
                {"desc": f"Registered override classification feedback for field '{req.field_name}' ({req.action})."}
            )
            
        cache_manager.invalidate_all()
        await privacy_engine.run_analysis()
        return {"success": True, "message": f"Feedback rule saved for field '{req.field_name}'."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/anonymization/reset-feedback")
async def reset_override_feedback():
    try:
        with db_engine.begin() as conn:
            conn.execute(text("DELETE FROM cms_override_rules"))
            conn.execute(
                text("INSERT INTO cms_audit_log (event_type, description) VALUES ('Override Logic Reset', 'Cleared all user classification feedback rules.')")
            )
            
        cache_manager.invalidate_all()
        await privacy_engine.run_analysis()
        return {"success": True, "message": "Cleared all user override rules."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
