"""
ScoreEvent ORM model — immutable audit ledger for all scoring actions.

Rules:
  - NEVER update an existing row
  - NEVER delete rows
  - One row per scoring event (module completion, hint penalty, bonus, admin adjustment)
  - A UNIQUE index on (user_id, module_id) with event_type=MODULE_COMPLETION prevents duplicate awards
"""
from sqlalchemy import Column, Integer, String, DateTime, Index, UniqueConstraint
from datetime import datetime
from app.models.base import Base


class ScoreEvent(Base):
    __tablename__ = "score_events"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, nullable=False, index=True)
    lab_id     = Column(String(100), nullable=False)
    track_id   = Column(String(100), nullable=True)   # NULL for OT labs
    module_id  = Column(String(150), nullable=False)
    event_type = Column(String(50), nullable=False, default="MODULE_COMPLETION")
    points     = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        # Prevents awarding MODULE_COMPLETION points for the same module twice.
        UniqueConstraint("user_id", "module_id", "event_type",
                         name="uq_score_event_user_module_type"),
        Index("idx_score_events_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<ScoreEvent id={self.id} user_id={self.user_id} "
            f"module_id={self.module_id!r} points={self.points} "
            f"event_type={self.event_type!r}>"
        )
