from pydantic import Field, StrictInt, model_validator

from app.models.features import EmployeeRole, ShiftType
from app.models.tip_model import MAX_REASONABLE_TIPS_PREDICTION_CENTS
from app.schemas.common import ShiftScopedRequest, StrictBase


class PostShiftTipFeatures(StrictBase):
    role: EmployeeRole = Field(
        description="Employee role worked during the closed shift.",
        examples=[EmployeeRole.SERVER],
    )

    shift_type: ShiftType = Field(
        description="Business shift type.",
        examples=[ShiftType.DINNER],
    )

    day_of_week: StrictInt = Field(
        ge=0,
        le=6,
        description="Day of week where Monday=0 and Sunday=6.",
        examples=[4],
    )

    hour_start: StrictInt = Field(
        ge=0,
        le=23,
        description="Shift start hour in 24-hour format.",
        examples=[17],
    )

    hour_end: StrictInt = Field(
        ge=0,
        le=23,
        description="Shift end hour in 24-hour format. Overnight shifts are allowed.",
        examples=[23],
    )

    employee_count: StrictInt = Field(
        ge=1,
        le=100,
        description="Actual number of employees who worked during the shift.",
        examples=[6],
    )

    expected_sales_cents: StrictInt = Field(
        ge=0,
        le=100_000_000,
        description="Expected sales captured for the shift, in cents.",
        examples=[420_050],
    )

    sales_total_cents: StrictInt = Field(
        ge=0,
        le=100_000_000,
        description="Actual sales total after shift close, in cents.",
        examples=[431_075],
    )

    assigned_sales_cents: StrictInt = Field(
        ge=0,
        le=100_000_000,
        description="Sales assigned to the employee after shift close, in cents.",
        examples=[168_450],
    )

    orders_count: StrictInt = Field(
        ge=0,
        le=100_000,
        description="Actual number of orders after shift close.",
        examples=[118],
    )

    @model_validator(mode="after")
    def validate_shift_duration(self) -> "PostShiftTipFeatures":
        duration_hours = (self.hour_end - self.hour_start) % 24

        if duration_hours == 0:
            raise ValueError("shift duration must be greater than 0 hours")

        if duration_hours > 16:
            raise ValueError("shift duration must not exceed 16 hours")

        return self


class PredictRequest(ShiftScopedRequest):
    features: PostShiftTipFeatures = Field(
        description="Post-shift feature payload used by the online individual tip model.",
    )


class PredictResponse(ShiftScopedRequest):
    prediction_cents: StrictInt = Field(
        ge=0,
        le=MAX_REASONABLE_TIPS_PREDICTION_CENTS,
        description="Predicted individual tips received, in cents.",
        examples=[61_525],
    )
    model_version: StrictInt = Field(
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
