"""
Application-wide constants and enumerations.
Single source of truth for track-to-lab mappings and score event types.
"""
from enum import Enum


class ScoreEventType(str, Enum):
    """Immutable enum for all score event types stored in score_events table."""
    MODULE_COMPLETION = "MODULE_COMPLETION"
    HINT_PENALTY = "HINT_PENALTY"
    BONUS = "BONUS"
    ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT"


# Lab IDs whose modules are tracked in UserProgress (interactive tracks).
# These labs use the track-based UserProgress table, NOT UserLabProgress.
TRACK_LAB_IDS: set = {
    "command-line-lab",
    "cryptography-lab",
    "cloud-security-lab",
    "lab1-recon",
}

# Canonical mapping from UserProgress.track_id → lab_id.
# Used by ScoreService and progress_service to resolve track rows to lab IDs.
TRACK_TO_LAB: dict = {
    "linux":  "command-line-lab",
    "python": "command-line-lab",
    "java":   "command-line-lab",
    "c":      "command-line-lab",
    "crypto": "cryptography-lab",
    "recon":  "lab1-recon",
    "cloud":  "cloud-security-lab",
    "techcorp-sysadmin-labs": "puzzle-lab",
    "puzzle": "puzzle-lab",
}
