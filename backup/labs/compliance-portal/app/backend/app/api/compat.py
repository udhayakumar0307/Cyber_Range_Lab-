from fastapi import APIRouter
from app.cache.cache_manager import cache_manager
from app.privacy_engine.engine import privacy_engine
from app.integrations.integration_manager import integration_manager

router = APIRouter()

@router.get("/consents")
async def get_consents_compat():
    data = cache_manager.get("consents")
    if not data:
        data = await integration_manager.fetch_and_normalize_customers()
        cache_manager.set("consents", data)
    return data

@router.get("/pii-results")
async def get_pii_results_compat():
    data = cache_manager.get("pii")
    if not data:
        await privacy_engine.run_analysis()
        data = cache_manager.get("pii")
    
    results = []
    if data and "fields" in data:
        for f in data["fields"]:
            # Map FastAPI schema to Express mock schema
            results.append({
                "table": "customer_address" if "address" in f["field"] else "customer",
                "column": f["field"],
                "is_pii": True,
                "pii_type": f["category"],
                "risk": f["riskLevel"]
            })
    return {
        "results": results,
        "total": len(results)
    }

@router.get("/pii-risk-details")
async def get_pii_risk_details_compat():
    data = cache_manager.get("pii")
    if not data:
        await privacy_engine.run_analysis()
        data = cache_manager.get("pii")
    
    fields = []
    risk_level = "Low"
    if data and "fields" in data:
        fields = [f["field"] for f in data["fields"]]
        risks = [f["riskLevel"] for f in data["fields"]]
        if "High" in risks:
            risk_level = "High"
        elif "Medium" in risks:
            risk_level = "Medium"

    return {
        "status": "success",
        "risk_level": risk_level,
        "data": {
            "fields": fields,
            "storage_location": "Local Database Store",
            "encryption": "AES-256"
        }
    }

@router.get("/pull-and-classify")
@router.post("/pull-and-classify")
async def pull_and_classify_compat():
    await privacy_engine.run_analysis()
    return {"status": "success", "message": "PII classification completed."}
