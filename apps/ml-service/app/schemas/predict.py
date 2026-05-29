from pydantic import Field, model_validator

from app.models.features import ShiftType
from app.schemas.common import ShiftScopedRequest, StrictBase


class PredictFeatures(StrictBase):
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
        description="Shift end hour in 24-hour format (inclusive). Overnight shifts are allowed.",
        examples=[23],
    )

    shift_type: ShiftType = Field(
        description="Business shift type.",
        examples=[ShiftType.DINNER],
    )

    employee_count: int = Field(
        ge=1,
        le=100,
        description="Number of employees scheduled for the shift.",
        examples=[6],
    )

    expected_sales: float = Field(
        ge=0.0,
        le=1_000_000.0,
        allow_inf_nan=False,
        description="Expected sales amount before shift closure. Must be finite.",
        examples=[4200.50],
    )

    expected_orders: int = Field(
        ge=0,
        le=100_000,
        description="Expected order count before shift closure.",
        examples=[110],
    )

    @model_validator(mode="after")
    def validate_shift_duration(self) -> "PredictFeatures":
        duration_hours = (self.hour_end - self.hour_start) % 24

        if duration_hours == 0:
            raise ValueError("shift duration must be greater than 0 hours")

        if duration_hours > 16:
            raise ValueError("shift duration must not exceed 16 hours")

        return self


class PredictRequest(ShiftScopedRequest):
    features: PredictFeatures = Field(
        description="Feature payload used by the online ML model.",
    )


class PredictResponse(ShiftScopedRequest):
    prediction: float = Field(
        ge=0.0,
        le=1_000_000.0,
        allow_inf_nan=False,
        description="Predicted total tips amount for the shift. Must be finite.",
        examples=[615.25],
    )
    model_version: int = Field(
        ge=0,
        description=(
            "Tenant-specific model version used for the prediction. "
            "Zero means cold-start model."
        ),
        examples=[42],
    )

    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
        description="Optional confidence score between 0 and 1. Null when unavailable.",
        examples=[0.78],
    )