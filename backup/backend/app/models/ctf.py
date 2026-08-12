"""
CTF module SQLAlchemy ORM models.

Tables
------
ctf                  – A competition event with a schedule, status, and settings.
ctf_challenge        – An individual challenge inside a CTF; supports static and
                       dynamic (logarithmic) scoring.
ctf_challenge_file   – Uploaded attachment files linked to a challenge.
ctf_hint             – Ordered hints for a challenge, each with a % cost.
ctf_hint_unlock      – Records when a participant unlocks a specific hint.
ctf_submission       – Every flag submission attempt (correct or incorrect).
ctf_participation    – One row per participant per CTF; tracks total points and
                       solve count.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


# ---------------------------------------------------------------------------
# CTF Event
# ---------------------------------------------------------------------------

class CTF(Base):
    """A CTF competition event."""

    __tablename__ = "ctf"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    # status: scheduled | active | paused | completed
    status = Column(String(50), nullable=False, default="scheduled")

    is_frozen = Column(Boolean, nullable=False, default=False)  # freeze scoreboard
    is_public = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    challenges = relationship(
        "CTFChallenge", back_populates="ctf", cascade="all, delete-orphan"
    )
    participations = relationship(
        "CTFParticipation", back_populates="ctf", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# CTF Challenge
# ---------------------------------------------------------------------------

class CTFChallenge(Base):
    """A challenge inside a CTF event."""

    __tablename__ = "ctf_challenge"

    id = Column(Integer, primary_key=True, index=True)
    ctf_id = Column(
        Integer, ForeignKey("ctf.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)           # Markdown / rich text
    category = Column(String(100), nullable=True)
    connection_string = Column(String(500), nullable=True)  # e.g. "nc host 1337"
    challenge_url = Column(String(500), nullable=True)      # URL from GCP deployment

    # ---- Scoring ----
    # scoring_mode: static | dynamic
    scoring_mode = Column(String(20), nullable=False, default="static")

    # Static scoring
    static_points = Column(Integer, nullable=True)

    # Dynamic scoring
    dynamic_ceiling = Column(Integer, nullable=True)    # max points (first blood)
    dynamic_floor = Column(Integer, nullable=True)      # minimum points
    decay_constant = Column(Float, nullable=True)       # k in max(floor, ceil(ceiling - k*ln(n)))

    # ---- Flag (stored hashed) ----
    flag_hash = Column(String(255), nullable=True)
    flag_salt = Column(String(64), nullable=True)

    # ---- Visibility & state ----
    is_hidden = Column(Boolean, nullable=False, default=False)
    url_active = Column(Boolean, nullable=False, default=True)
    solve_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    ctf = relationship("CTF", back_populates="challenges")
    files = relationship(
        "CTFChallengeFile", back_populates="challenge", cascade="all, delete-orphan"
    )
    hints = relationship(
        "CTFHint",
        back_populates="challenge",
        cascade="all, delete-orphan",
        order_by="CTFHint.order_index",
    )
    submissions = relationship(
        "CTFSubmission", back_populates="challenge", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# CTF Challenge File (attachments)
# ---------------------------------------------------------------------------

class CTFChallengeFile(Base):
    """An uploaded attachment file for a challenge."""

    __tablename__ = "ctf_challenge_file"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(
        Integer,
        ForeignKey("ctf_challenge.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)   # server-side path / object key
    mime_type = Column(String(100), nullable=True)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    challenge = relationship("CTFChallenge", back_populates="files")


# ---------------------------------------------------------------------------
# CTF Hint
# ---------------------------------------------------------------------------

class CTFHint(Base):
    """An ordered hint for a challenge, with a percentage cost."""

    __tablename__ = "ctf_hint"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(
        Integer,
        ForeignKey("ctf_challenge.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    order_index = Column(Integer, nullable=False, default=0)  # display order
    text = Column(Text, nullable=False)                        # revealed on unlock
    # cost_percent: e.g. 20 means -20% of the challenge's current point value
    cost_percent = Column(Float, nullable=False, default=0.0)

    # Relationships
    challenge = relationship("CTFChallenge", back_populates="hints")
    unlocks = relationship(
        "CTFHintUnlock", back_populates="hint", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# CTF Hint Unlock
# ---------------------------------------------------------------------------

class CTFHintUnlock(Base):
    """Records when a participant unlocks a specific hint (irreversible)."""

    __tablename__ = "ctf_hint_unlock"
    __table_args__ = (
        # A participant can only unlock each hint once.
        UniqueConstraint("hint_id", "participant_id", name="uq_hint_unlock_participant"),
    )

    id = Column(Integer, primary_key=True, index=True)
    hint_id = Column(
        Integer, ForeignKey("ctf_hint.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # participant_id references users.id
    participant_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    unlocked_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    hint = relationship("CTFHint", back_populates="unlocks")


# ---------------------------------------------------------------------------
# CTF Submission
# ---------------------------------------------------------------------------

class CTFSubmission(Base):
    """Every flag submission attempt by a participant for a challenge."""

    __tablename__ = "ctf_submission"
    __table_args__ = (
        Index("ix_ctf_submission_challenge_participant", "challenge_id", "participant_id"),
        Index("ix_ctf_submission_submitted_at", "submitted_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(
        Integer,
        ForeignKey("ctf_challenge.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    participant_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    submitted_flag_hash = Column(String(255), nullable=False)  # hashed for privacy
    is_correct = Column(Boolean, nullable=False, default=False)

    # is_first_blood: True only for the very first correct submission on this challenge.
    # First-blood points are locked at ceiling and never retroactively reduced.
    is_first_blood = Column(Boolean, nullable=False, default=False)

    submitted_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # points_credited: actual points this participant earned (after hint penalties).
    # For non-first-blood dynamic challenges, this is updated by the background
    # recalculation task each time a new correct solve lowers the challenge value.
    points_credited = Column(Integer, nullable=False, default=0)

    # hint_penalty_percent: cumulative % reduction applied at submission time.
    hint_penalty_percent = Column(Float, nullable=False, default=0.0)

    # Relationships
    challenge = relationship("CTFChallenge", back_populates="submissions")


# ---------------------------------------------------------------------------
# CTF Participation
# ---------------------------------------------------------------------------

class CTFParticipation(Base):
    """Aggregate row tracking a participant's standing within a CTF."""

    __tablename__ = "ctf_participation"
    __table_args__ = (
        UniqueConstraint("ctf_id", "participant_id", name="uq_ctf_participation"),
        Index("ix_ctf_participation_ctf_id", "ctf_id"),
        Index("ix_ctf_participation_participant_id", "participant_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    ctf_id = Column(
        Integer, ForeignKey("ctf.id", ondelete="CASCADE"), nullable=False, index=True
    )
    participant_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    total_points = Column(Integer, nullable=False, default=0)
    solve_count = Column(Integer, nullable=False, default=0)
    last_submission_at = Column(DateTime, nullable=True)

    joined_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    ctf = relationship("CTF", back_populates="participations")
