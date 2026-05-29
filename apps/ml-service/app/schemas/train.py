import re
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.models.features import ShiftType
from app.schemas.common import ShiftScopedRequest, StrictBase

IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[a-zA-Z0-9:_./-]{8,256}$")


class TrainFeatures(StrictBase):
    day_of_week: int = Field(
        ge=0,
        le=6,
        description="Day of week where Monday=0 and Sunday=6.",
        examples=[4],
    )

    hour_start: int = Field(
        ge=0,
        le=23,
        description="Shift start hour in 24-hour format.",
        examples=[17],
    )

    hour_end: int = Field(
        ge=0,
        le=23,
        description="Shift end hour in 24-hour format. Overnight shifts are allowed.",
        examples=[23],
    )

    shift_type: ShiftType = Field(
        description="Business shift type.",
        examples=[ShiftType.DINNER],
    )

    employee_count: int = Field(
        ge=1,
        le=100,
        description="Actual number of employees who worked during the shift.",
        examples=[6],
    )

    sales_total: float = Field(
        ge=0.0,
        le=1_000_000.0,
        allow_inf_nan=False,
        description="Actual sales total after shift closure. Must be finite.",
        examples=[4310.75],
    )

    orders_count: int = Field(
        ge=0,
        le=100_000,
        description="Actual number of orders after shift closure.",
        examples=[118],
    )

    @model_validator(mode="after")
    def validate_shift_duration(self) -> "TrainFeatures":
        duration_hours = (self.hour_end - self.hour_start) % 24

        if duration_hours == 0:
            raise ValueError("shift duration must be greater than 0 hours")

        if duration_hours > 16:
            raise ValueError("shift duration must not exceed 16 hours")

        return self


class TrainTarget(StrictBase):
    tips_total: float = Field(
        ge=0.0,
        le=1_000_000.0,
        allow_inf_nan=False,
        description="Actual total tips collected for the closed shift. Must be finite.",
        examples=[642.35],
    )


class TrainRequest(ShiftScopedRequest):
    features: TrainFeatures = Field(
        description="Training features known after shift closure.",
    )

    target: TrainTarget = Field(
        description="Training target for online learning.",
    )

    idempotency_key: str = Field(
        min_length=8,
        max_length=256,
        description="Stable idempotency key. Usually tenant_id:shift_id:target:v1.",
        examples=["7f4d3c2a:shift:f15dfc77:tips_total:v1"],
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

    model_version: int = Field(
        ge=0,
        description="Tenant-specific model version after the train operation.",
        examples=[43],
    )