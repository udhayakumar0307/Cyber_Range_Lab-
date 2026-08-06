"""
labs_api.py — Optimized Labs Endpoint
======================================
Key optimizations:
  1. Batch module query: loads ALL modules in ONE query, groups by lab_id in Python.
     Eliminates the N+1 query pattern (was: 1 query per lab for modules).
  2. Lab metadata cached 10 minutes (TTL). Only user-specific progress is dynamic.
  3. Progress reuses the cached progress_service result (shared with dashboard).
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

_LAB_CACHE_KEY = "labs:all_active"
_LAB_CACHE_TTL = 600  # 10 minutes


def _build_labs_metadata(db: Session) -> list:
    """
    Load all active labs + all their modules in exactly 2 queries.
    Returns a list of dicts ready for the API response (minus user progress).
    Cached for 10 minutes since lab metadata rarely changes.
    """
    cached = lab_cache.get(_LAB_CACHE_KEY)
    if cached is not None:
        logger.debug("[Labs] Cache HIT — returning cached lab metadata")
        return cached

    # Query 1: all active labs
    labs = (
        db.query(Lab)
        .filter(Lab.status == "ACTIVE")
        .order_by(Lab.created_at.desc())
        .all()
    )

    if not labs:
        lab_cache.set(_LAB_CACHE_KEY, [], ttl=_LAB_CACHE_TTL)
        return []

    lab_ids = [lab.id for lab in labs]

    # Query 2: ALL modules for all active labs in one batch query
    all_modules = (
        db.query(LabModule)
        .filter(LabModule.lab_id.in_(lab_ids))
        .order_by(LabModule.display_order)
        .all()
    )

    # Group modules by lab_id in memory — O(n) Python, no extra DB round-trips
    modules_by_lab: dict[str, list] = collections.defaultdict(list)
    for mod in all_modules:
        modules_by_lab[mod.lab_id].append(mod)

    result = []
    for lab in labs:
        lab_modules = modules_by_lab[lab.id]
        cap = _MODULE_CAP.get(lab.id)
        if cap:
            lab_modules = lab_modules[:cap]

        # Standardize durations per specification
        is_puzzle = "puzzle" in lab.id.lower() or (lab.category and "puzzle" in lab.category.lower())
        is_command_line = "command-line" in lab.id.lower() or "cmd" in lab.id.lower()
        
        if is_puzzle:
            duration_str = "Unlimited"
            duration_val = 0
            price_val = 0
            is_free = True
        elif is_command_line:
            duration_str = "6 Hours"
            duration_val = 6.0
            price_val = lab.price_inr
            is_free = False
        else:
            duration_str = "1.5 Hours"
            duration_val = 1.5
            price_val = lab.price_inr
            is_free = False

        result.append({
            "id": lab.id,
            "title": lab.name,
            "name": lab.name,
            "category": lab.category,
            "difficulty": lab.difficulty,
            "shortDescription": lab.description or f"Hands-on {lab.name} challenge.",
            "fullDescription": lab.description or f"Complete practical cybersecurity lab covering {lab.category}.",
            "priceInr": price_val,
            "isFree": is_free,
            "durationHours": duration_val,
            "durationDisplay": duration_str,
            "rating": lab.rating,
            "reviewCount": lab.review_count,
            "skillsCovered": [lab.category],
            "prerequisites": [],
            "dockerImage": lab.docker_image,
            "isPurchased": False,
            "totalChallenges": len(lab_modules),
            "modules": [
                {"id": m.id, "title": m.title, "durationMinutes": 45, "points": m.points}
                for m in lab_modules
            ],
        })

    lab_cache.set(_LAB_CACHE_KEY, result, ttl=_LAB_CACHE_TTL)
    logger.debug(f"[Labs] Cached {len(result)} labs with modules.")
    return result


@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
def get_labs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """
    Returns all active labs with module metadata and user progress.

    Performance:
      - Lab + module metadata: 2 DB queries, result cached 10 min
      - User progress: 4 optimized queries via progress_service (cached 60s)
      - Total queries on cache miss: 6
      - Total queries on cache hit: 0 (pure in-memory)
    """
    labs_metadata = _build_labs_metadata(db)

    # No user — return metadata without progress
    if not current_user:
        return [
            {**lab, "solvedChallenges": 0}
            for lab in labs_metadata
        ]

    # Check student user type
    user_auth_type = getattr(current_user, "auth_type", "INDIVIDUAL")

    if user_auth_type == "SSO":
        # Fetch assigned lab IDs for currently logged-in student (individual or group assignments)
        from app.models.assignment import Assignment
        student_group_id = getattr(current_user, "group_id", None)
        
        assigned_query = db.query(Assignment).filter(
            (Assignment.student_id == current_user.id) |
            (Assignment.group_id == student_group_id)
        )
        assigned_lab_ids = {a.lab_id for a in assigned_query.all() if a.lab_id}

        # Filter metadata list to only contain assigned labs
        active_labs_metadata = [
            lab for lab in labs_metadata if lab["id"] in assigned_lab_ids
        ]
    else:
        # Individual / personal / organization user: show all labs, but set isPurchased status
        from app.models.admin_models import PurchasedLab, AdminProfile
        from sqlalchemy import or_, and_

        user_org_id = None
        if current_user.group:
            user_org_id = current_user.group.organization_id

        admin_prof = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
        if admin_prof:
            user_org_id = admin_prof.organization_id

        conditions = [
            PurchasedLab.user_id == current_user.id
        ]
        if user_org_id is not None:
            conditions.append(
                and_(
                    PurchasedLab.organization_id == user_org_id,
                    PurchasedLab.assigned_to.in_(["student", "both", "org"])
                )
            )

        # Global manual student assignments
        conditions.append(
            and_(
                PurchasedLab.organization_id.is_(None),
                PurchasedLab.assigned_to.in_(["student", "both"])
            )
        )

        purchased = db.query(PurchasedLab).filter(
            or_(*conditions),
            PurchasedLab.status == "ACTIVE"
        ).all()
        purchased_lab_ids = {p.lab_id for p in purchased}

        active_labs_metadata = []
        for lab in labs_metadata:
            is_pur = lab["id"] in purchased_lab_ids
            active_labs_metadata.append({
                **lab,
                "isPurchased": is_pur
            })

    # User progress — reuses progress_service cache (shared with dashboard)
    from app.services.progress_service import get_user_lab_statistics
    stats = get_user_lab_statistics(db, str(current_user.id))
    lab_completed = stats["lab_completed_modules"]

    result = []
    for lab in active_labs_metadata:
        cap = _MODULE_CAP.get(lab["id"])
        solved = lab_completed.get(lab["id"], 0)
        if cap:
            solved = min(solved, cap)

        result.append({
            **lab,
            "solvedChallenges": solved,
        })

    return result
