from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class SysadminSubmissionRequest(BaseModel):
    lab_id: str = Field(min_length=3, max_length=64)
    filename: str = Field(min_length=1, max_length=128)
    content: str = Field(min_length=1)

    @field_validator("lab_id", "filename")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class CriterionResult(BaseModel):
    id: str
    passed: bool
    points: int
    max_points: int
    feedback: str


class SysadminSubmissionResponse(BaseModel):
    submission_id: int
    lab_id: str
    filename: str
    status: str
    score: int | None = None
    max_score: int | None = None
    pass_score: int | None = None
    passed: bool | None = None
    tests: list[CriterionResult] = Field(default_factory=list)
    submitted_at: datetime
    graded_at: datetime | None = None
    error: str | None = None


class SysadminGradingStatusResponse(BaseModel):
    enabled: bool
    configured: bool
    available_labs: list[str]
    detail: str
