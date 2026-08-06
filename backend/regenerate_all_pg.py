"""
Regenerate ALL certificate PNGs/PDFs from PostgreSQL (live DB).
Uses the app's own DB session so it works with any backend (SQLite or Postgres).
"""
import sys, os, json, asyncio
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load rules
RULES_PATH = os.path.join(os.path.dirname(__file__), "app", "core", "certificate_rules.json")
with open(RULES_PATH, "r") as f:
    rules_cfg = json.load(f)
rules = rules_cfg.get("rules", {})

from app.database.session  import get_db
from app.models.certificate import Certificate
from app.models.user        import User
from app.services.certificate_service import certificate_service
from app.services.storage_provider    import storage_provider

db = next(get_db())

certs = db.query(Certificate).all()
print(f"Found {len(certs)} certificates to regenerate (PostgreSQL).\n")

success, failed = 0, 0

for cert in certs:
    display_id = cert.display_certificate_id
    lab_id     = cert.lab_id

    # Resolve user name
    user = db.query(User).filter(User.id == cert.user_id).first()
    recipient_name = (user.name or user.email.split("@")[0]) if user else f"Student #{cert.user_id}"

    # Resolve rule metadata
    rule     = rules.get(lab_id) or rules.get(f"ach-{lab_id}") or {}
    lab_title = rule.get("cert_target_name", lab_id.replace("-", " ").title())
    trigger   = rule.get("trigger_type", "lab_completion")

    # Date
    try:
        dt = cert.created_at
        date_str = dt.strftime("%d %b %Y").upper()
    except Exception:
        date_str = datetime.utcnow().strftime("%d %b %Y").upper()

    verify_url   = f"http://localhost:5173/certificate/verify/{display_id}"
    score        = 800 if trigger == "lab_completion" else 0
    percentage   = 100
    points       = rule.get("min_points", 100) if trigger == "profile_score" else 200
    duration_str = "2 Hours"

    try:
        png_bytes = certificate_service.render_png(
            lab_id=lab_id, display_id=display_id, recipient_name=recipient_name,
            lab_title=lab_title, category="Cyber Security",
            score=score, percentage=percentage, points=points,
            date_str=date_str, duration_str=duration_str, verify_url=verify_url,
        )
        pdf_bytes = certificate_service.render_pdf(
            lab_id=lab_id, display_id=display_id, recipient_name=recipient_name,
            lab_title=lab_title, category="Cyber Security",
            score=score, percentage=percentage, points=points,
            date_str=date_str, duration_str=duration_str, verify_url=verify_url,
        )

        new_png = storage_provider.save(png_bytes, f"png/{display_id}.png")
        new_pdf = storage_provider.save(pdf_bytes, f"pdf/{display_id}.pdf")

        cert.png_path = new_png
        cert.pdf_path = new_pdf
        db.commit()

        print(f"  ✅ {display_id}  ({recipient_name}  |  {lab_title})")
        success += 1

    except Exception as e:
        db.rollback()
        print(f"  ❌ {display_id}  FAILED: {e}")
        failed += 1

db.close()
print(f"\nDone — {success} regenerated, {failed} failed.")
