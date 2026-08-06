"""
Seed a real certificate for user keshikachandru45@gmail.com (or first student user)
using the actual certificate_service renderer so the PNG matches the new template.
"""
import sys, os, uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DB_PATH = os.path.join(os.path.dirname(__file__), "cyberrange.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)
db = Session()

# ── pick a user ──────────────────────────────────────────────────────────────
rows = db.execute(text("SELECT id, name, email FROM users")).fetchall()
print("Available users:")
for r in rows:
    print(f"  [{r[0]}] {r[2]}  ({r[1]})")

# prefer keshika or the last student user
target_user = None
for r in rows:
    if "keshika" in r[2].lower() or r[0] == max(r2[0] for r2 in rows):
        target_user = r
if not target_user:
    target_user = rows[0]

user_id   = target_user[0]
user_name = target_user[1]
user_email= target_user[2]
print(f"\nGenerating certificate for: {user_name} <{user_email}>")

# ── pick a lab ───────────────────────────────────────────────────────────────
labs = db.execute(text("SELECT id, name, category FROM labs")).fetchall()
lab = labs[0]
lab_id    = lab[0]
lab_title = lab[1]
lab_cat   = lab[2] or "Cyber Security"
print(f"Lab: {lab_title} ({lab_id})")

# ── generate IDs ─────────────────────────────────────────────────────────────
cert_uuid = str(uuid.uuid4())
year      = datetime.utcnow().year
count_row = db.execute(text("SELECT COUNT(*) FROM certificates")).scalar()
display_id = f"CYR-{year}-{(count_row + 1):06d}"
date_str   = datetime.utcnow().strftime("%d %B %Y")

# ── render via certificate_service ───────────────────────────────────────────
from app.services.certificate_service import certificate_service
from app.services.storage_provider import storage_provider

verify_url = f"/certificate/verify/{display_id}"

png_bytes = certificate_service.render_png(
    lab_id       = lab_id,
    display_id   = display_id,
    recipient_name = user_name,
    lab_title    = lab_title,
    category     = lab_cat,
    score        = 800,
    percentage   = 100,
    points       = 200,
    date_str     = date_str,
    duration_str = "2 Hours",
    verify_url   = verify_url,
)

pdf_bytes = certificate_service.render_pdf(
    lab_id       = lab_id,
    display_id   = display_id,
    recipient_name = user_name,
    lab_title    = lab_title,
    category     = lab_cat,
    score        = 800,
    percentage   = 100,
    points       = 200,
    date_str     = date_str,
    duration_str = "2 Hours",
    verify_url   = verify_url,
)

png_path = storage_provider.save(png_bytes, f"png/{display_id}.png")
pdf_path = storage_provider.save(pdf_bytes, f"pdf/{display_id}.pdf")
print(f"PNG saved → {png_path}")
print(f"PDF saved → {pdf_path}")

# ── insert into DB ────────────────────────────────────────────────────────────
db.execute(text("""
    INSERT OR REPLACE INTO certificates (uuid, display_certificate_id, user_id, lab_id, pdf_path, png_path, created_at)
    VALUES (:uuid, :did, :uid, :lid, :pdf, :png, :created_at)
"""), {
    "uuid": cert_uuid,
    "did":  display_id,
    "uid":  user_id,
    "lid":  lab_id,
    "pdf":  pdf_path,
    "png":  png_path,
    "created_at": datetime.utcnow().isoformat(),
})
db.commit()
print(f"\n✅ Certificate seeded: {display_id}")
print(f"   PNG URL: {png_path}")
print(f"   Verify:  http://localhost:5173/certificate/verify/{display_id}")
