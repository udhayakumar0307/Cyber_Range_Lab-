import os
import json
import shutil
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.study_material import StudyMaterial
from app.models.user import User

router = APIRouter()

PUBLIC_STUDY_MATERIALS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))),
    "public",
    "study-materials"
)

def _serialize_material(m: StudyMaterial) -> dict:
    content_list = []
    if m.content_json:
        try:
            content_list = json.loads(m.content_json)
        except Exception:
            content_list = [m.content_json]

    return {
        "id": str(m.id),
        "title": m.title,
        "category": m.category,
        "description": m.description or "",
        "readTime": m.read_time or "15 min read",
        "difficulty": m.difficulty or "Intermediate",
        "lastUpdated": m.last_updated or (m.created_at.strftime("%b %Y") if m.created_at else "Aug 2026"),
        "pdfUrl": m.pdf_url,
        "content": content_list
    }

@router.get("", response_model=List[dict])
def get_study_materials(db: Session = Depends(get_db)):
    """Fetch all published study materials."""
    materials = db.query(StudyMaterial).filter(StudyMaterial.is_published == True).order_by(StudyMaterial.id.asc()).all()
    return [_serialize_material(m) for m in materials]

@router.post("/admin/upload", status_code=status.HTTP_201_CREATED)
async def upload_admin_study_material(
    title: str = Form(...),
    category: str = Form(...),
    description: str = Form(...),
    read_time: str = Form("15 min read"),
    difficulty: str = Form("Intermediate"),
    content_bullets: str = Form("[]"),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to create a study material card and optional PDF file upload."""
    if not current_user.role or current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin authorization required.")

    pdf_url = None
    if file and file.filename:
        os.makedirs(PUBLIC_STUDY_MATERIALS_DIR, exist_ok=True)
        safe_filename = "".join([c for c in file.filename if c.isalnum() or c in (".", "_", "-")]).lower()
        dest_path = os.path.join(PUBLIC_STUDY_MATERIALS_DIR, safe_filename)
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        pdf_url = f"/study-materials/{safe_filename}"

    new_material = StudyMaterial(
        title=title,
        category=category,
        description=description,
        read_time=read_time,
        difficulty=difficulty,
        last_updated=datetime.utcnow().strftime("%b %Y"),
        pdf_url=pdf_url,
        content_json=content_bullets,
        is_published=True
    )
    db.add(new_material)
    db.commit()
    db.refresh(new_material)
    return {"status": "success", "material": _serialize_material(new_material)}

@router.delete("/admin/{material_id}")
def delete_admin_study_material(
    material_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to delete a study material record."""
    if not current_user.role or current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin authorization required.")

    item = db.query(StudyMaterial).filter(StudyMaterial.id == material_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Study material not found.")

    db.delete(item)
    db.commit()
    return {"status": "success", "message": f"Study material {material_id} deleted."}
