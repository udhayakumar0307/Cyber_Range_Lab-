# backend/schemas/admin.py
import json
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from backend.config import ALL_ROLES, GUARDRAIL_DEFAULT_MAX_CONCURRENT, GUARDRAIL_DEFAULT_MAX_DURATION_HOURS


class CourseCreateRequest(BaseModel):
    title:            str            = Field(..., min_length=3, max_length=200)
    description:      Optional[str]  = None
    difficulty:       Optional[str]  = None
    duration_minutes: Optional[int]  = None
    lab_type:         str            = Field(
        ...,
        description="Must match a Terraform lab directory — e.g. 'windows' or 'lab-2'",
    )

    @property
    def metadata_json(self) -> str:
        """Serialize lab_type into the metadata JSONB column."""
        return json.dumps({"lab_type": self.lab_type})


class GuardrailSetRequest(BaseModel):
    max_concurrent_deployments: int = Field(
        default=GUARDRAIL_DEFAULT_MAX_CONCURRENT,
        ge=1,
        le=50,
    )
    max_duration_hours: int = Field(
        default=GUARDRAIL_DEFAULT_MAX_DURATION_HOURS,
        ge=1,
        le=72,
    )


class RoleSetRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ALL_ROLES:
            raise ValueError(
                f"Invalid role '{v}'. Must be one of: {', '.join(sorted(ALL_ROLES))}"
            )
        return v