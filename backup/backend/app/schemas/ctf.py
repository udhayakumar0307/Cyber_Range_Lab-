"""
Pydantic request/response schemas for the CTF module.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Hint schemas
# ---------------------------------------------------------------------------

class HintCreate(BaseModel):
    order_index: int = 0
    text: str
    cost_percent: float = Field(default=0.0, ge=0.0, le=99.0)


class HintOut(BaseModel):
    id: int
    order_index: int
    cost_percent: float
    # text is only present after unlock — omitted from list views
    text: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Challenge schemas
# ---------------------------------------------------------------------------

class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    connection_string: Optional[str] = None
    challenge_url: Optional[str] = None
    flag: str  # plain-text; hashed server-side before storage
    scoring_mode: str = Field(default="static", pattern="^(static|dynamic)$")

    # Static scoring
    static_points: Optional[int] = Field(default=None, ge=1)

    # Dynamic scoring
    dynamic_ceiling: Optional[int] = Field(default=None, ge=1)
    dynamic_floor: Optional[int] = Field(default=None, ge=1)
    decay_constant: Optional[float] = Field(default=None, gt=0)

    hints: List[HintCreate] = []

    @model_validator(mode="after")
    def check_scoring_fields(self) -> "ChallengeCreate":
        if self.scoring_mode == "static":
            if self.static_points is None:
                raise ValueError("static_points is required for static scoring mode")
        else:
            for field in ("dynamic_ceiling", "dynamic_floor", "decay_constant"):
                if getattr(self, field) is None:
                    raise ValueError(f"{field} is required for dynamic scoring mode")
            if self.dynamic_floor >= self.dynamic_ceiling:
                raise ValueError("dynamic_floor must be less than dynamic_ceiling")
        return self


class ChallengeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    connection_string: Optional[str] = None
    challenge_url: Optional[str] = None
    flag: Optional[str] = None
    scoring_mode: Optional[str] = Field(default=None, pattern="^(static|dynamic)$")
    static_points: Optional[int] = Field(default=None, ge=1)
    dynamic_ceiling: Optional[int] = Field(default=None, ge=1)
    dynamic_floor: Optional[int] = Field(default=None, ge=1)
    decay_constant: Optional[float] = Field(default=None, gt=0)
    hints: Optional[List[HintCreate]] = None


class ChallengeFileOut(BaseModel):
    id: int
    filename: str
    mime_type: Optional[str]
    file_size_bytes: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ChallengeOut(BaseModel):
    id: int
    ctf_id: int
    title: str
    description: Optional[str]
    category: Optional[str]
    connection_string: Optional[str]
    challenge_url: Optional[str]
    scoring_mode: str
    static_points: Optional[int]
    dynamic_ceiling: Optional[int]
    dynamic_floor: Optional[int]
    decay_constant: Optional[float]
    is_hidden: bool
    url_active: bool
    solve_count: int
    current_points: Optional[int] = None  # computed field set by endpoint
    files: List[ChallengeFileOut] = []
    hints: List[HintOut] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# CTF Event schemas
# ---------------------------------------------------------------------------

class CTFCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    is_public: bool = True

    @model_validator(mode="after")
    def check_times(self) -> "CTFCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class CTFUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_frozen: Optional[bool] = None
    is_public: Optional[bool] = None


class CTFOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    status: str
    is_frozen: bool
    is_public: bool
    created_at: datetime
    is_included: bool = False  # true if a sysadmin/org PurchasedCTF allocation already covers this event

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Submission schemas
# ---------------------------------------------------------------------------

class FlagSubmitRequest(BaseModel):
    flag: str


class FlagSubmitResponse(BaseModel):
    correct: bool
    message: str
    points_credited: int = 0
    is_first_blood: bool = False


# ---------------------------------------------------------------------------
# Hint unlock schemas
# ---------------------------------------------------------------------------

class HintUnlockResponse(BaseModel):
    hint_id: int
    text: str
    cost_percent: float
    points_after_penalty: int


# ---------------------------------------------------------------------------
# Leaderboard schemas
# ---------------------------------------------------------------------------

class LeaderboardEntry(BaseModel):
    rank: int
    participant_id: int
    participant_name: str
    total_points: int
    solve_count: int
    last_submission_at: Optional[datetime]
    first_blood_challenges: List[int] = []  # challenge IDs where this user has first blood


class LeaderboardResponse(BaseModel):
    ctf_id: int
    is_frozen: bool
    entries: List[LeaderboardEntry]


# ---------------------------------------------------------------------------
# Submission audit log schemas
# ---------------------------------------------------------------------------

class SubmissionLogEntry(BaseModel):
    id: int
    challenge_id: int
    challenge_title: str
    participant_id: int
    participant_name: str
    is_correct: bool
    is_first_blood: bool
    submitted_at: datetime
    points_credited: int
    hint_penalty_percent: float

    class Config:
        from_attributes = True


class SubmissionLogResponse(BaseModel):
    total: int
    page: int
    limit: int
    entries: List[SubmissionLogEntry]
