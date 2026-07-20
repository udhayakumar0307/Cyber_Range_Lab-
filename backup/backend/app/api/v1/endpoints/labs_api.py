import logging
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.lab import Lab
from app.models.lab_module import LabModule

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
def get_labs(db: Session = Depends(get_db)):
    """
    Returns all labs directly from PostgreSQL database.
    """
    labs = db.query(Lab).filter(Lab.status == "ACTIVE").order_by(Lab.created_at.desc()).all()
    
    result = []
    for l in labs:
        modules = db.query(LabModule).filter(LabModule.lab_id == l.id).all()
        result.append({
            "id": l.id,
            "title": l.name,
            "name": l.name,
            "category": l.category,
            "difficulty": l.difficulty,
            "shortDescription": l.description or f"Hands-on {l.name} challenge.",
            "fullDescription": l.description or f"Complete practical cybersecurity lab covering {l.category}.",
            "priceInr": l.price_inr,
            "durationHours": l.estimated_time,
            "rating": l.rating,
            "reviewCount": l.review_count,
            "skillsCovered": [l.category],
            "prerequisites": [],
            "dockerImage": l.docker_image,
            "isPurchased": False,
            "modules": [
                {
                    "id": m.id,
                    "title": m.title,
                    "durationMinutes": 45,
                    "points": m.points
                } for m in modules
            ]
        })
    return result
