from fastapi import APIRouter, Depends, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class ReportGenerateRequest(BaseModel):
    name: str
    category: str
    format: str  # "PDF" or "CSV"

@router.get("/reports")
def get_reports(db: Session = Depends(get_db)):
    # Fetch recent reports from database
    recent_rows = db.execute(text(
        "SELECT name, category, format, size, status, timestamp FROM cms_generated_reports ORDER BY id DESC LIMIT 10"
    )).fetchall()
    
    recent_list = []
    for r in recent_rows:
        row_dict = dict(r._mapping)
        ts = row_dict["timestamp"]
        ts_str = ts.isoformat() + "Z" if hasattr(ts, "isoformat") else str(ts)
        recent_list.append({
            "name": row_dict["name"],
            "category": row_dict["category"],
            "format": row_dict["format"],
            "size": row_dict["size"],
            "status": row_dict["status"],
            "generated": ts_str
        })
        
    # Return structured templates
    return {
        "complianceReports": [
            { "id": "dpdp_audit", "name": "DPDP Compliance Audit Report", "lastGenerated": datetime.utcnow().isoformat() + "Z", "format": "PDF, CSV" },
            { "id": "dpia_assess", "name": "Data Protection Impact Assessment (DPIA)", "lastGenerated": datetime.utcnow().isoformat() + "Z", "format": "PDF" }
        ],
        "consentReports": [
            { "id": "consent_registry", "name": "Customer Consent Registry Audit", "lastGenerated": datetime.utcnow().isoformat() + "Z", "format": "PDF, CSV" },
            { "id": "consent_revocation", "name": "Consent Revocation Analytics", "lastGenerated": datetime.utcnow().isoformat() + "Z", "format": "CSV" }
        ],
        "privacyReports": [
            { "id": "pii_inventory", "name": "PII Data Inventory Mapping", "lastGenerated": datetime.utcnow().isoformat() + "Z", "format": "PDF, CSV" },
            { "id": "disclosure_trail", "name": "Third-Party Sharing Disclosures Trail", "lastGenerated": datetime.utcnow().isoformat() + "Z", "format": "CSV" }
        ],
        "overallConsolidatedReport": [
            { "id": "consolidated_audit", "name": "Consolidated Privacy Posture Audit", "lastGenerated": datetime.utcnow().isoformat() + "Z", "format": "PDF, CSV" }
        ],
        "recent": recent_list
    }

@router.post("/reports/generate")
def generate_report(req: dict, db: Session = Depends(get_db)):
    try:
        name = req.get("name", "Compliance Audit Report")
        fmt = req.get("type") or req.get("format") or "PDF"
        cat = req.get("category") or "Compliance"
        
        # Insert generated report entry
        db.execute(
            text("INSERT INTO cms_generated_reports (name, category, format, size, status) "
                 "VALUES (:name, :cat, :fmt, '450 KB', 'Ready')"),
            {"name": name, "cat": cat, "fmt": fmt}
        )
        
        # Log to audit trail
        db.execute(
            text("INSERT INTO cms_audit_log (event_type, description) VALUES ('Report Generated', :desc)"),
            {"desc": f"Successfully generated report '{name}' in {fmt} format."}
        )
        db.commit()
        
        return {
            "success": True,
            "message": f"Report '{name}' generated successfully."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/download/{id}")
def download_report(id: str):
    # Simulate binary response headers
    if id.endswith(".csv"):
        content = "id,name,status,timestamp\n1,Rahul Sharma,Approved,2026-08-04T10:30:00Z"
        media = "text/csv"
    else:
        content = "MOCK_PDF_REPORT_BINARY"
        media = "application/pdf"
        
    return Response(content=content, media_type=media, headers={"Content-Disposition": f"attachment; filename={id}"})
