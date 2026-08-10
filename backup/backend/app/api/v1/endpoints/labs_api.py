"""
labs_api.py — Labs Endpoint (SysAdmin-assigned only)
=====================================================
Key design:
  1. ONLY labs assigned by the SysAdmin (PurchasedLab records with organization_id=None)
     are shown in both student and admin portals.
  2. The price shown is the fixed_rate set by the SysAdmin (NOT the lab's default price_inr).
  3. Free assignments (fixed_rate == 0): isPurchased=True -> Launch Lab directly.
  4. Priced assignments (fixed_rate > 0): shown with Add to Cart -> Razorpay -> Launch.
  5. After a student pays, their PurchasedLab record (with user_id set) returns isPurchased=True.
"""

import logging
import collections
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user_optional
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.core.cache import lab_cache

logger = logging.getLogger(__name__)
router = APIRouter()

# Labs that require capped module counts due to legacy DB noise
_MODULE_CAP = {
    "cloud-security-lab": 5,
    "command-line-lab": 5,
    "lab1-recon": 5,
    "recon-lab": 5,
    "ot-security-lab": 5,
    "ot-railroad-north": 5,
    "ot-water-treatment": 5,
}

_SYSADMIN_CACHE_KEY = "labs:sysadmin_assignments"
_SYSADMIN_CACHE_TTL = 60  # 60 seconds


def _get_sysadmin_assignments(db: Session) -> list:
    """
    Fetch all active SysAdmin global lab assignments where organization_id IS NULL.
    These are platform-level assignments set via the SysAdmin portal.
    Returns a list of dicts: {lab_id, assigned_to, fixed_rate}.
    """
    cached = lab_cache.get(_SYSADMIN_CACHE_KEY)
    if cached is not None:
        return cached

    from app.models.admin_models import PurchasedLab
    assignments = (
        db.query(PurchasedLab)
        .filter(
            PurchasedLab.organization_id.is_(None),
            PurchasedLab.status == "ACTIVE"
        )
        .all()
    )

    result = [
        {
            "lab_id": a.lab_id,
            "assigned_to": (a.assigned_to or "both").lower(),
            "fixed_rate": a.fixed_rate if a.fixed_rate is not None else 0.0,
        }
        for a in assignments
    ]
    lab_cache.set(_SYSADMIN_CACHE_KEY, result, ttl=_SYSADMIN_CACHE_TTL)
    return result


def _build_assigned_labs(db: Session, assignments: list) -> list:
    """
    Given SysAdmin assignment dicts, fetch Lab metadata and build lab cards.
    If no custom assignments exist, fall back to querying all active labs.
    """
    ALLOWED_LAB_IDS = ["command-line-lab", "cryptography-lab", "cloud-security-lab"]
    if not assignments:
        labs = db.query(Lab).filter(Lab.id.in_(ALLOWED_LAB_IDS), Lab.status == "ACTIVE").all()
        price_map = {}
        assigned_to_map = {}
    else:
        assigned_lab_ids = [a["lab_id"] for a in assignments if a["lab_id"] in ALLOWED_LAB_IDS]
        price_map = {a["lab_id"]: a["fixed_rate"] for a in assignments if a["lab_id"] in ALLOWED_LAB_IDS}
        assigned_to_map = {a["lab_id"]: a["assigned_to"] for a in assignments if a["lab_id"] in ALLOWED_LAB_IDS}
        labs = (
            db.query(Lab)
            .filter(Lab.id.in_(ALLOWED_LAB_IDS), Lab.status == "ACTIVE")
            .all()
        )
    # Sort labs deterministically to match specified catalog order
    lab_order = {lab_id: idx for idx, lab_id in enumerate(ALLOWED_LAB_IDS)}
    labs = sorted(labs, key=lambda l: lab_order.get(l.id, 99))

    if not labs:
        return []

    lab_ids = [lab.id for lab in labs]
    all_modules = (
        db.query(LabModule)
        .filter(LabModule.lab_id.in_(lab_ids))
        .order_by(LabModule.display_order)
        .all()
    )

    modules_by_lab: dict = collections.defaultdict(list)
    for mod in all_modules:
        modules_by_lab[mod.lab_id].append(mod)

    result = []
    for lab in labs:
        lab_modules = modules_by_lab[lab.id]
        cap = _MODULE_CAP.get(lab.id)
        if cap:
            lab_modules = lab_modules[:cap]

        is_command_line = "command-line" in lab.id.lower() or "cmd" in lab.id.lower()
        fixed_rate = price_map.get(lab.id, lab.price_inr if getattr(lab, 'price_inr', None) is not None else 0.0)
        is_free = (fixed_rate == 0.0)

        duration_str = "6 Hours" if is_command_line else "1.5 Hours"
        duration_val = 6.0 if is_command_line else 1.5

        result.append({
            "id": lab.id,
            "title": lab.name,
            "name": lab.name,
            "category": lab.category,
            "difficulty": lab.difficulty,
            "shortDescription": lab.description or f"Hands-on {lab.name} challenge.",
            "fullDescription": lab.description or f"Complete practical cybersecurity lab covering {lab.category}.",
            "priceInr": fixed_rate,
            "isFree": is_free,
            "durationHours": duration_val,
            "durationDisplay": duration_str,
            "rating": lab.rating,
            "reviewCount": lab.review_count,
            "skillsCovered": [lab.category],
            "prerequisites": [],
            "dockerImage": lab.docker_image,
            "isPurchased": False,
            "assignedTo": assigned_to_map.get(lab.id, "both"),
            "totalChallenges": len(lab_modules),
            "modules": [
                {"id": m.id, "title": m.title, "durationMinutes": 45, "points": m.points}
                for m in lab_modules
            ],
        })

    return result


@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
def get_labs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """
    Returns ONLY SysAdmin-assigned labs with their SysAdmin-set custom pricing.

    Free (fixed_rate=0): isPurchased=True -> Launch Lab directly.
    Priced (fixed_rate>0): isPurchased=False -> Add to Cart -> Razorpay -> Launch.
    """
    # Step 1: Fetch all SysAdmin-assigned labs
    assignments = _get_sysadmin_assignments(db)

    # Step 2: Build lab cards with SysAdmin pricing
    labs_metadata = _build_assigned_labs(db, assignments)
    if not labs_metadata:
        return []

    # No user — return without purchase/progress status
    if not current_user:
        return [{**lab, "solvedChallenges": 0} for lab in labs_metadata]

    # Fetch user's active purchased lab IDs from database
    from app.models.admin_models import PurchasedLab
    purchased_records = db.query(PurchasedLab).filter(
        PurchasedLab.user_id == current_user.id,
        PurchasedLab.status == "ACTIVE"
    ).all()
    user_purchased_ids = {p.lab_id for p in purchased_records}

    # Show all sysadmin-assigned labs to every student (no SSO/INDIVIDUAL restriction).
    # Free labs -> Launch. Priced labs -> Add to Cart.
    active_labs_metadata = []
    for lab in labs_metadata:
        # A lab is purchased if it's free OR if the student bought it
        is_free_lab = lab["priceInr"] == 0.0 or lab.get("isFree", False)
        is_purchased = is_free_lab or (lab["id"] in user_purchased_ids)
        active_labs_metadata.append({**lab, "isPurchased": is_purchased})

    # Step 3: Attach progress
    from app.services.progress_service import get_user_lab_statistics
    stats = get_user_lab_statistics(db, str(current_user.id))
    lab_completed = stats["lab_completed_modules"]

    result = []
    for lab in active_labs_metadata:
        cap = _MODULE_CAP.get(lab["id"])
        solved = lab_completed.get(lab["id"], 0)
        if cap:
            solved = min(solved, cap)
        result.append({**lab, "solvedChallenges": solved})

    return result

