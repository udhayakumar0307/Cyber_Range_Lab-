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


class WorkspaceTokenRequest(BaseModel):
    lab_id: str = Field(min_length=3, max_length=64)

    @field_validator("lab_id")
    @classmethod
    def strip_lab_id(cls, value: str) -> str:
        return value.strip()


class WorkspaceTokenResponse(BaseModel):
    token: str
    token_type: str = "Bearer"
    lab_id: str
    workspace_id: str
    expires_at: datetime
    submit_endpoint: str = "/api/v1/sysadmin-grading/workspace-submit"


class WorkspaceSubmissionRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=128)
    content: str = Field(min_length=1)

    @field_validator("filename")
    @classmethod
    def strip_filename(cls, value: str) -> str:
        return value.strip()


class SysadminRubricCriterion(BaseModel):
    id: str
    points: int = Field(ge=0)


class SysadminLabSummary(BaseModel):
    lab_id: str
    title: str
    version: str
    module: str
    difficulty: str
    learning_objectives: list[str] = Field(default_factory=list)
    submission_filename: str
    interpreter: str
    total_points: int = Field(ge=0)
    pass_score: int = Field(ge=0)
    rubric: list[SysadminRubricCriterion] = Field(default_factory=list)


class SysadminLabDetail(SysadminLabSummary):
    question_markdown: str


class SysadminWorkspaceStartRequest(BaseModel):
    lab_id: str = Field(min_length=3, max_length=64)

    @field_validator("lab_id")
    @classmethod
    def strip_workspace_lab_id(cls, value: str) -> str:
        return value.strip()


class SysadminWorkspaceResponse(BaseModel):
    workspace_id: str
    lab_id: str
    status: str
    terminal_ready: bool
    started_at: datetime | None = None
    expires_at: datetime | None = None


class SysadminWorkspaceStopResponse(BaseModel):
    stopped: bool
