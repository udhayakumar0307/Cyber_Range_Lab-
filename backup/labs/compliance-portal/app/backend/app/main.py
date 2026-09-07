from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
import app.models.integration
import app.models.logs
from app.scheduler.scheduler import aps_scheduler
from app.api.v1 import (
    health,
    dashboard,
    integration,
    consent,
    dpdp,
    pii,
    anonymization,
    reports,
    settings as settings_router
)
from app.api import compat

# 1. Initialize DB tables
Base.metadata.create_all(bind=engine)

# Seed default configs if empty
try:
    from sqlalchemy import text
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM cms_integration_config")).scalar()
        if count == 0:
            conn.execute(text("""
                INSERT INTO cms_integration_config 
                (store_name, store_url, platform, connection_status, api_version, last_sync)
                VALUES 
                ('My Business Platform', 'http://localhost:8088', 'Custom REST', 'Disconnected', 'v1.0', CURRENT_TIMESTAMP)
            """))
            print("Seeded initial cms_integration_config successfully.")
        
        # Database migration: alter cms_hash_audit to add sharing_medium if missing
        try:
            conn.execute(text("ALTER TABLE cms_hash_audit ADD COLUMN sharing_medium VARCHAR(100)"))
            print("Successfully migrated cms_hash_audit table to add sharing_medium.")
        except Exception:
            pass

        # Seed cms_consent_records from local customer tables if it is empty
        consent_count = conn.execute(text("SELECT COUNT(*) FROM cms_consent_records")).scalar()
        if consent_count == 0:
            try:
                query = """
                    SELECT c.customer_id AS id,
                           c.full_name AS name,
                           c.email,
                           ca.telephone AS phone,
                           ca.address_1 AS address,
                           ca.consent AS purpose,
                           ca.consent_status AS status,
                           c.created_at AS created,
                           c.created_at AS updated
                    FROM customer c
                    LEFT JOIN customer_address ca ON ca.customer_id = c.customer_id AND ca.is_default = 1
                    ORDER BY c.customer_id ASC
                """
                rows = conn.execute(text(query)).fetchall()
                for r in rows:
                    import json
                    c_dict = {
                        "id": str(r[0]),
                        "user_id": str(r[0]),
                        "name": r[1] or "Unknown",
                        "email": r[2] or "",
                        "phone": r[3] or "",
                        "address": r[4] or "",
                        "purpose": r[5].replace("Consent for ", "") if r[5] else "Marketing",
                        "status": "Approved" if r[6] in ("granted", "approved") else "Revoked" if r[6] == "revoked" else "Pending",
                        "consent_status": r[6] or "Pending",
                        "is_minor": False,
                        "age_category": "adult",
                        "data_principal_type": "individual",
                        "guardian_consent": None,
                        "parent_contact": None
                    }
                    conn.execute(text("""
                        INSERT INTO cms_consent_records (
                            customer_id, name, email, phone, address, consent_purpose, consent_status,
                            is_minor, age_category, data_principal_type, raw_data
                        ) VALUES (
                            :cid, :name, :email, :phone, :address, :purpose, :status,
                            0, 'adult', 'individual', :raw
                        )
                    """), {
                        "cid": c_dict["id"],
                        "name": c_dict["name"],
                        "email": c_dict["email"],
                        "phone": c_dict["phone"],
                        "address": c_dict["address"],
                        "purpose": c_dict["purpose"],
                        "status": c_dict["status"],
                        "raw": json.dumps(c_dict)
                    })
                print(f"Seeded {len(rows)} customer records into cms_consent_records successfully.")
            except Exception as e:
                print("Skipped initial local customer records seeding:", e)
except Exception as e:
    print("Database seeding info:", e)

# 2. Build FastAPI Instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# 3. Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Mount versioned APIRouter endpoints
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(dashboard.router, prefix=settings.API_V1_STR, tags=["Dashboard"])
app.include_router(integration.router, prefix=settings.API_V1_STR, tags=["Integration"])
app.include_router(consent.router, prefix=settings.API_V1_STR, tags=["Consent"])
app.include_router(dpdp.router, prefix=settings.API_V1_STR, tags=["DPDP"])
app.include_router(pii.router, prefix=settings.API_V1_STR, tags=["PII"])
app.include_router(anonymization.router, prefix=settings.API_V1_STR, tags=["Anonymization"])
app.include_router(reports.router, prefix=settings.API_V1_STR, tags=["Reports"])
app.include_router(settings_router.router, prefix=settings.API_V1_STR, tags=["Settings"])
app.include_router(compat.router, prefix="/api", tags=["Compatibility"])

# 5. APScheduler Start & Stop Hooks
@app.on_event("startup")
def startup_event():
    aps_scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    aps_scheduler.stop()
