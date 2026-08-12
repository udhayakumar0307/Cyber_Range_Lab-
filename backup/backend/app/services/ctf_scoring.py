"""
CTF Scoring Engine
==================

Implements:
  - Static scoring  : fixed points × (1 – cumulative hint penalty %)
  - Dynamic scoring : max(floor, ceil(ceiling – k × ln(n))) with first-blood protection
  - Hint penalty    : per-participant cumulative %, capped so minimum payout ≥ 1 pt
  - Retroactive     : after each new solve on a dynamic challenge, all non-first-blood
                      solvers' points_credited are updated, and participation totals
                      are recalculated.
"""

from __future__ import annotations

import math
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.ctf import (
    CTFChallenge,
    CTFHintUnlock,
    CTFSubmission,
    CTFParticipation,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Hint penalty helpers
# ---------------------------------------------------------------------------

def get_hint_penalty_pct(db: Session, participant_id: int, challenge_id: int) -> float:
    """
    Return the cumulative hint-penalty percentage for a participant on a challenge.
    E.g. if they unlocked two hints with cost_percent 20 and 15, returns 35.0.
    Capped at 99 so the minimum payout is always ≥ 1 pt.
    """
    from app.models.ctf import CTFHint

    unlocked_hint_ids = [
        row.hint_id
        for row in db.query(CTFHintUnlock)
        .filter(
            CTFHintUnlock.participant_id == participant_id,
            CTFHintUnlock.hint_id.in_(
                db.query(CTFHint.id).filter(CTFHint.challenge_id == challenge_id)
            ),
        )
        .all()
    ]

    if not unlocked_hint_ids:
        return 0.0

    from app.models.ctf import CTFHint as Hint

    hints = db.query(Hint).filter(Hint.id.in_(unlocked_hint_ids)).all()
    total = sum(h.cost_percent for h in hints)
    return min(total, 99.0)  # cap so minimum payout ≥ 1 pt


# ---------------------------------------------------------------------------
# Point computation
# ---------------------------------------------------------------------------

def compute_static_points(static_points: int, hint_penalty_pct: float) -> int:
    """Return points after applying hint penalty. Minimum 1."""
    result = static_points * (1.0 - hint_penalty_pct / 100.0)
    return max(1, math.floor(result))


def compute_dynamic_value(ceiling: int, floor: int, k: float, n: int) -> int:
    """
    Current challenge value based on number of solves n.
    Formula: max(floor, ceil(ceiling – k × ln(n)))
    n must be ≥ 1. When n == 1, ln(1) == 0, so value == ceiling.
    """
    if n <= 0:
        return ceiling
    raw = ceiling - k * math.log(n)
    return max(floor, math.ceil(raw))


def apply_hint_penalty(base_points: int, hint_penalty_pct: float) -> int:
    """Apply a percentage penalty to a base point value. Minimum 1."""
    result = base_points * (1.0 - hint_penalty_pct / 100.0)
    return max(1, math.floor(result))


# ---------------------------------------------------------------------------
# Submission scoring — called synchronously inside the submission endpoint
# ---------------------------------------------------------------------------

def score_correct_submission(
    db: Session,
    challenge: CTFChallenge,
    participant_id: int,
) -> tuple[int, bool]:
    """
    Score a correct submission. Returns (points_credited, is_first_blood).

    Rules:
      - Static:  points = static_points × (1 – hint_penalty %)
      - Dynamic (first blood, n==1): points = ceiling × (1 – hint_penalty %)
                 → locked forever (is_first_blood=True)
      - Dynamic (subsequent, n≥2):  points = compute_dynamic_value(n) × (1 – hint_penalty %)
                 → subject to retroactive recalculation
    """
    hint_pct = get_hint_penalty_pct(db, participant_id, challenge.id)
    is_first_blood = False

    if challenge.scoring_mode == "static":
        points = compute_static_points(challenge.static_points, hint_pct)

    else:  # dynamic
        # n after this solve
        n = challenge.solve_count + 1  # solve_count incremented after this call
        is_first_blood = (n == 1)

        if is_first_blood:
            # First solver gets full ceiling (locked permanently)
            base = challenge.dynamic_ceiling
        else:
            base = compute_dynamic_value(
                challenge.dynamic_ceiling,
                challenge.dynamic_floor,
                challenge.decay_constant,
                n,
            )
        points = apply_hint_penalty(base, hint_pct)

    return points, is_first_blood


# ---------------------------------------------------------------------------
# Retroactive dynamic recalculation — called as a background task
# ---------------------------------------------------------------------------

def recalculate_dynamic_scores(db: Session, challenge_id: int) -> None:
    """
    After a new correct solve on a dynamic challenge, recompute points_credited
    for all non-first-blood correct submissions and update participation totals.

    First-blood submissions (is_first_blood=True) are NEVER touched.
    """
    challenge = db.query(CTFChallenge).filter(CTFChallenge.id == challenge_id).first()
    if not challenge or challenge.scoring_mode != "dynamic":
        return

    n = challenge.solve_count  # already incremented by the submission endpoint

    # Current challenge value (same for every non-first-blood solver)
    current_value = compute_dynamic_value(
        challenge.dynamic_ceiling,
        challenge.dynamic_floor,
        challenge.decay_constant,
        n,
    )

    # Fetch all non-first-blood correct submissions for this challenge
    submissions = (
        db.query(CTFSubmission)
        .filter(
            CTFSubmission.challenge_id == challenge_id,
            CTFSubmission.is_correct == True,
            CTFSubmission.is_first_blood == False,
        )
        .all()
    )

    affected_participant_ids = set()
    for sub in submissions:
        # Re-apply that participant's hint penalty to the new current_value
        hint_pct = get_hint_penalty_pct(db, sub.participant_id, challenge_id)
        new_points = apply_hint_penalty(current_value, hint_pct)
        sub.points_credited = new_points
        affected_participant_ids.add(sub.participant_id)

    db.flush()

    # Recalculate participation totals for all affected participants
    for pid in affected_participant_ids:
        recompute_participation_total(db, pid, challenge.ctf_id)

    db.commit()
    logger.info(
        "Dynamic recalculation done: challenge=%d n=%d current_value=%d affected=%d",
        challenge_id,
        n,
        current_value,
        len(affected_participant_ids),
    )


# ---------------------------------------------------------------------------
# Participation total recomputation
# ---------------------------------------------------------------------------

def recompute_participation_total(db: Session, participant_id: int, ctf_id: int) -> None:
    """
    Recompute ctf_participation.total_points by summing points_credited from
    all correct, non-duplicate submissions for this participant in this CTF.
    """
    from app.models.ctf import CTFChallenge as Ch

    # Sum points_credited from correct submissions within this CTF
    correct_subs = (
        db.query(CTFSubmission)
        .join(Ch, CTFSubmission.challenge_id == Ch.id)
        .filter(
            Ch.ctf_id == ctf_id,
            CTFSubmission.participant_id == participant_id,
            CTFSubmission.is_correct == True,
        )
        .all()
    )

    # Deduplicate by challenge (keep first correct per challenge)
    seen: set[int] = set()
    total = 0
    for sub in sorted(correct_subs, key=lambda s: s.submitted_at):
        if sub.challenge_id not in seen:
            seen.add(sub.challenge_id)
            total += sub.points_credited

    participation = (
        db.query(CTFParticipation)
        .filter(
            CTFParticipation.ctf_id == ctf_id,
            CTFParticipation.participant_id == participant_id,
        )
        .first()
    )
    if participation:
        participation.total_points = total
        db.flush()
