from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Index,
    text,
)
from datetime import datetime

from app.models.base import Base


class ScoreEvent(Base):
    __tablename__ = "score_events"

    id = Column(Integer, primary_key=True, autoincrement=True)

    assignment_id = Column(
        Integer,
        ForeignKey("assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user_id = Column(Integer, nullable=False, index=True)
    lab_id = Column(String(100), nullable=False)
    track_id = Column(String(100), nullable=True)
    module_id = Column(String(150), nullable=False)
    event_type = Column(
        String(50),
        nullable=False,
        default="MODULE_COMPLETION",
    )
    points = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index(
            "uq_score_event_assignment_module_type",
            "user_id",
            "assignment_id",
            "module_id",
            "event_type",
            unique=True,
            postgresql_where=text("assignment_id IS NOT NULL"),
            sqlite_where=text("assignment_id IS NOT NULL"),
        ),

        Index(
            "uq_score_event_legacy_module_type",
            "user_id",
            "module_id",
            "event_type",
            unique=True,
            postgresql_where=text("assignment_id IS NULL"),
            sqlite_where=text("assignment_id IS NULL"),
        ),

        Index("idx_score_events_user_id", "user_id"),
    )