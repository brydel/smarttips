from __future__ import annotations

import re
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.models.distribution_features import EmployeeRole
from app.models.features import ShiftType
from app.schemas.common import UUID4, ShiftScopedRequest, StrictBase

IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[a-zA-Z0-9:_./-]{8,256}$")


class DistributionEmployeeFeatures(StrictBase):
    employee_id: UUID4 = Field(
        description="Employee UUID v4 receiving a distribution share.",
    )
    role: EmployeeRole
    shift_type: ShiftType
    day_of_week: int = Field(ge=0, le=6)
    hour_start: int = Field(ge=0, le=23)
    hour_end: int = Field(ge=0, le=23)
    employee_count: int = Field(ge=1, le=100)
    sales_total_cents: int = Field(ge=0, le=100_000_000)
    assigned_sales_cents: int = Field(ge=0, le=100_000_000)
    orders_count: int = Field(ge=0, le=100_000)

    @model_validator(mode="after")
    def validate_shift_duration(self) -> DistributionEmployeeFeatures:
        duration_hours = (self.hour_end - self.hour_start) % 24

        if duration_hours == 0:
            raise ValueError("error.distribution.features.shift_duration.zero")

        if duration_hours > 16:
            raise ValueError("error.distribution.features.shift_duration.too_long")

        return self


class DistributionTrainingExample(DistributionEmployeeFeatures):
    tips_received_cents: int = Field(ge=0, le=100_000_000)


class DistributionPredictRequest(ShiftScopedRequest):
    pool_cents: int = Field(ge=0, le=100_000_000)
    employees: tuple[DistributionEmployeeFeatures, ...] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_employee_counts(self) -> DistributionPredictRequest:
        expected_count = len(self.employees)

        for employee in self.employees:
            if employee.employee_count != expected_count:
                raise ValueError("error.distribution.features.employee_count.mismatch")

        return self


class DistributionTrainRequest(ShiftScopedRequest):
    employees: tuple[DistributionTrainingExample, ...] = Field(min_length=1, max_length=100)
    idempotency_key: str = Field(min_length=8, max_length=256)

    @field_validator("idempotency_key")
    @classmethod
    def validate_idempotency_key(cls, value: str) -> str:
        normalized = value.strip()

        if not IDEMPOTENCY_KEY_PATTERN.fullmatch(normalized):
            raise ValueError("error.distribution.train.idempotency_key.invalid")

        return normalized

    @model_validator(mode="after")
    def validate_employee_counts(self) -> DistributionTrainRequest:
        expected_count = len(self.employees)

        for employee in self.employees:
            if employee.employee_count != expected_count:
                raise ValueError("error.distribution.features.employee_count.mismatch")

        return self


class DistributionAllocationResponse(StrictBase):
    employee_id: UUID4
    tips_cents: int = Field(ge=0, le=100_000_000)
    weight: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)
    share: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)


class DistributionPredictResponse(ShiftScopedRequest):
    pool_cents: int = Field(ge=0, le=100_000_000)
    allocations: tuple[DistributionAllocationResponse, ...]
    model_version: int = Field(ge=0)


class DistributionTrainResponse(ShiftScopedRequest):
    status: Literal["trained", "already_trained"] = Field(
        description="Training operation result.",
    )
    model_version: int = Field(ge=0)
    skipped_zero_pool: bool
