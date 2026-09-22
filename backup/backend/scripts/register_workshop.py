"""Register the workshop for assignment; does not assign participants or start labs."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dataclasses import replace
from app.database.session import SessionLocal
from app.models.lab import Lab
from app.services.sysadmin_grading.config import SysadminGradingSettings
from app.services.sysadmin_grading.catalog_sync import sync_sysadmin_lab_modules
from app.services.sysadmin_grading.workshop import WORKSHOP_ID


def register(db, settings):
    settings = replace(settings, marketplace_lab_id=WORKSHOP_ID)
    lab = db.query(Lab).filter(Lab.id == WORKSHOP_ID).first()
    if lab is None:
        lab = Lab(id=WORKSHOP_ID, name="Linux Security and Cyber Defense Workshop",
                  category="Linux Security", difficulty="Mixed", estimated_time=960,
                  description="Two-day workshop: nine core labs and three advanced incident challenges.",
                  status="ACTIVE", price_inr=0, price_per_hour=0, registry_path="question-bank:linux-security-workshop")
        db.add(lab)
        db.flush()
    return sync_sysadmin_lab_modules(db, settings=settings)

if __name__ == "__main__":
    with SessionLocal() as db:
        result = register(db, SysadminGradingSettings.from_env())
        db.commit()
        print(result)
