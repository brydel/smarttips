import re
from typing import Literal

from pydantic import Field, StrictInt, field_validator

from app.models.tip_model import MAX_REASONABLE_TIPS_PREDICTION_CENTS
from app.schemas.common import ShiftScopedRequest, StrictBase
from app.schemas.predict import PostShiftTipFeatures

IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[a-zA-Z0-9:_./-]{8,256}$")


class TrainTarget(StrictBase):
    tips_received_cents: StrictInt = Field(
        ge=0,
        le=MAX_REASONABLE_TIPS_PREDICTION_CENTS,
        description="Actual individual tips received after shift close, in cents.",
        examples=[64_235],
    )


class TrainRequest(ShiftScopedRequest):
    features: PostShiftTipFeatures = Field(
        description="Training features known after shift closure.",
    )

    target: TrainTarget = Field(
        description="Training target for online learning.",
    )

    idempotency_key: str = Field(
        min_length=8,
        max_length=256,
        description="Stable idempotency key. Usually tenant_id:shift_id:employee_id:tips:v1.",
        examples=["7f4d3c2a:shift:f15dfc77:employee:8a45:tips:v1"],
    )

    @field_validator("idempotency_key")
    @classmethod
    def validate_idempotency_key(cls, value: str) -> str:
        normalized = value.strip()

        if not IDEMPOTENCY_KEY_PATTERN.fullmatch(normalized):
            raise ValueError(
                "idempotency_key must contain only letters, numbers, ':', '_', '.', '/', '-' "
                "and must be between 8 and 256 characters"
            )

        return normalized


class TrainResponse(ShiftScopedRequest):
    status: Literal["trained", "already_trained"] = Field(
        description="Training operation result.",
        examples=["trained"],
    )

    model_version: StrictInt = Field(
        ge=0,
        description="Tenant-specific model version after the train operation.",
        examples=[43],
    )
