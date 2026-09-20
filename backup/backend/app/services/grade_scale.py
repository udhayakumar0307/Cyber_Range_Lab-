"""
Canonical percent -> letter grade mapping.

Single source of truth so every surface (roster, reports, gradebook,
student portal) agrees on the same bands regardless of how a lab's
total points are configured. The higher band wins at an exact boundary
(e.g. exactly 90.0 -> "O", not "A+").
"""

from __future__ import annotations

from typing import List, Optional, Tuple

GRADE_BANDS: List[Tuple[float, str]] = [
    (90.0, "O"),
    (80.0, "A+"),
    (70.0, "A"),
    (60.0, "B+"),
    (50.0, "B"),
    (40.0, "C"),
]

FAIL_GRADE = "R"


def get_letter_grade(percent: Optional[float]) -> Optional[str]:
    """Map a 0-100 percent to a letter grade, or None when ungradeable."""
    if percent is None:
        return None

    value = float(percent)
    for threshold, grade in GRADE_BANDS:
        if value >= threshold:
            return grade
    return FAIL_GRADE
