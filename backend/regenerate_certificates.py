"""
Regenerate all existing certificate PNGs & PDFs with the new formal font.
Keeps exact same template design, colours, layout — only recipient name
font changes from cursive GreatVibes to PlusJakartaSans-Bold.
"""
import sys, os, json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DB_PATH = os.path.join(os.path.dirname(__file__), "cyberrange.db")
engine  = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)
db      = Session()

# Load certificate rules for dynamic metadata
RULES_PATH = os.path.join(os.path.dirname(__file__), "app", "core", "certificate_rules.json")
with open(RULES_PATH, "r") as f:
    rules_cfg = json.load(f)
rules = rules_cfg.get("rules", {})

from app.services.certificate_service import certificate_service
from app.services.storage_provider   import storage_provider
from app.models.user                 import User

certs = db.execute(text(
    "SELECT uuid, display_certificate_id, user_id, lab_id, pdf_path, png_path, created_at FROM certificates"
)).fetchall()

print(f"Found {len(certs)} certificates to regenerate.\n")

success, failed = 0, 0

for row in certs:
    cert_uuid, display_id, user_id, lab_id, pdf_path, png_path, created_at = row

    # Resolve user name
    user_row = db.execute(text("SELECT name, email FROM users WHERE id = :uid"), {"uid": user_id}).fetchone()
    recipient_name = (user_row[0] or user_row[1].split("@")[0]) if user_row else f"Student #{user_id}"

    # Resolve lab title & rule metadata
    rule = rules.get(lab_id) or rules.get(f"ach-{lab_id}") or {}
    lab_title = rule.get("cert_target_name", lab_id.replace("-", " ").title())
    category  = "Cyber Security"
    trigger   = rule.get("trigger_type", "lab_completion")

    # Resolve date
    try:
        dt = datetime.fromisoformat(str(created_at))
        date_str = dt.strftime("%d %b %Y").upper()
    except Exception:
        date_str = datetime.utcnow().strftime("%d %b %Y").upper()

    verify_url    = f"http://localhost:5173/certificate/verify/{display_id}"
    duration_str  = "2 Hours"
    score         = 800 if trigger == "lab_completion" else 0
    percentage    = 100
    points        = rule.get("min_points", 100) if trigger == "profile_score" else 200

    try:
        # Re-render PNG (new formal font)
        png_bytes = certificate_service.render_png(
            lab_id=lab_id,
            display_id=display_id,
            recipient_name=recipient_name,
            lab_title=lab_title,
            category=category,
            score=score,
            percentage=percentage,
            points=points,
            date_str=date_str,
            duration_str=duration_str,
            verify_url=verify_url,
        )

        # Re-render PDF
        pdf_bytes = certificate_service.render_pdf(
            lab_id=lab_id,
            display_id=display_id,
            recipient_name=recipient_name,
            lab_title=lab_title,
            category=category,
            score=score,
            percentage=percentage,
            points=points,
            date_str=date_str,
            duration_str=duration_str,
            verify_url=verify_url,
        )

        # Overwrite existing files
        new_png_path = storage_provider.save(png_bytes, f"png/{display_id}.png")
        new_pdf_path = storage_provider.save(pdf_bytes, f"pdf/{display_id}.pdf")

        # Update DB paths (in case they changed)
        db.execute(text("""
            UPDATE certificates SET png_path = :png, pdf_path = :pdf WHERE uuid = :uuid
        """), {"png": new_png_path, "pdf": new_pdf_path, "uuid": cert_uuid})
        db.commit()

        print(f"  ✅ {display_id}  ({recipient_name}  |  {lab_title})")
        success += 1

    except Exception as e:
        print(f"  ❌ {display_id}  FAILED: {e}")
        failed += 1

print(f"\nDone — {success} regenerated, {failed} failed.")
