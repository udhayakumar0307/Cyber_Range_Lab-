import os
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter()

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "cache", "settings.json")

DEFAULT_SETTINGS = {
  "organization": { 
      "name": "IIT Madras Internship Project", 
      "industry": "Technology", 
      "contactEmail": "privacy@iitm.ac.in",
      "country": "India",
      "officer": "Dharani Krishnan"
  },
  "api": { 
      "version": "v1.0", 
      "rateLimit": "100 requests/min", 
      "webhookUrl": "http://localhost:4000/webhook",
      "timeout": 30,
      "retry": 3
  },
  "retention": { 
      "customerDataYears": "3", 
      "auditLogsDays": "180", 
      "hashLogsDays": "365",
      "defaultDuration": "3 Years",
      "expiredDeletion": "Automated purging",
      "backupPeriod": "180 Days"
  },
  "notifications": { 
      "emailAlerts": "Critical Only", 
      "weeklySummary": True, 
      "criticalIssues": True,
      "slackChannel": "https://hooks.slack.com/services/..."
  },
  "users": [
      {"name": "Admin User", "role": "Privacy Administrator", "email": "admin@iitm.ac.in", "status": "Active"},
      {"name": "Audit Inspector", "role": "External Auditor", "email": "auditor@audit.gov", "status": "Active"}
  ],
  "webhooks": [
      {"url": "http://localhost:4000/webhook", "event": "Consent Revoked", "status": "Active"}
  ]
}

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_SETTINGS

def save_settings(data):
    try:
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        with open(SETTINGS_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print("Failed to save settings:", e)

@router.get("/settings")
def get_settings():
    return load_settings()

@router.put("/settings")
def update_settings(req: dict, db: Session = Depends(get_db)):
    save_settings(req)
    
    db.execute(text("INSERT INTO cms_audit_log (event_type, description) VALUES ('Settings Updated', 'CMS configurations refreshed.')"))
    db.commit()
    return {"success": True}
