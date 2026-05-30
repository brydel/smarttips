from __future__ import annotations

import math
from dataclasses import dataclass, fields, is_dataclass
from datetime import date
from enum import StrEnum
from typing import Final, NewType, TypeAlias
from uuid import UUID

MoneyCents = NewType("MoneyCents", int)
MinuteOfDay = NewType("MinuteOfDay", int)


def money_cents(value: int) -> MoneyCents:
    if isinstance(value, bool):
        raise TypeError("error.money.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError("error.money.not_int")
    if value < 0:
        raise ValueError("error.money.negative")
    return MoneyCents(value)


def minute_of_day(value: int) -> MinuteOfDay:
    if isinstance(value, bool):
        raise TypeError("error.time.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError("error.time.not_int")
    if value < 0 or value > 24 * 60:
        raise ValueError("error.time.minute_of_day.out_of_range")
    return MinuteOfDay(value)


def _require_non_empty_text(field_name: str, value: str) -> None:
    if not isinstance(value, str):
        raise TypeError(f"error.domain.{field_name}.not_string")
    if not value.strip():
        raise ValueError(f"error.domain.{field_name}.empty")


def _require_positive_int(field_name: str, value: int) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.domain.{field_name}.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError(f"error.domain.{field_name}.not_int")
    if value <= 0:
        raise ValueError(f"error.domain.{field_name}.not_positive")


def _require_non_negative_int(field_name: str, value: int) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.domain.{field_name}.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError(f"error.domain.{field_name}.not_int")
    if value < 0:
        raise ValueError(f"error.domain.{field_name}.negative")


def _require_day_of_week(value: int) -> None:
    if isinstance(value, bool):
        raise TypeError("error.domain.day_of_week.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError("error.domain.day_of_week.not_int")
    if value < 0 or value > 6:
        raise ValueError("error.domain.day_of_week.out_of_range")


def _require_minute_of_day(field_name: str, value: int) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.domain.{field_name}.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError(f"error.domain.{field_name}.not_int")
    if value < 0 or value > 24 * 60:
        raise ValueError(f"error.domain.{field_name}.out_of_range")


def _require_finite_float(field_name: str, value: float) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.domain.{field_name}.bool_unsupported")
    if not isinstance(value, int | float):
        raise TypeError(f"error.domain.{field_name}.not_number")
    if not math.isfinite(float(value)):
        raise ValueError(f"error.domain.{field_name}.not_finite")


def _require_unit_interval(field_name: str, value: float) -> None:
    _require_finite_float(field_name, value)
    if value < 0.0 or value > 1.0:
        raise ValueError(f"error.domain.{field_name}.out_of_range")


class EmployeeRole(StrEnum):
    SERVER = "SERVER"
    BARTENDER = "BARTENDER"
    BUSSER = "BUSSER"
    HOST = "HOST"
    COOK = "COOK"
    CHEF = "CHEF"


class ShiftType(StrEnum):
    LUNCH = "LUNCH"
    DINNER = "DINNER"


@dataclass(frozen=True, slots=True, kw_only=True)
class Employee:
    id: UUID
    first_name: str
    last_name: str
    email: str
    role: EmployeeRole
    hired_at: date

    def __post_init__(self) -> None:
        _require_non_empty_text("first_name", self.first_name)
        _require_non_empty_text("last_name", self.last_name)
        _require_non_empty_text("email", self.email)


@dataclass(frozen=True, slots=True, kw_only=True)
class MenuItem:
    id: UUID
    name: str
    category: str
    base_price_cents: MoneyCents
    active: bool = True

    def __post_init__(self) -> None:
        _require_non_empty_text("name", self.name)
        _require_non_empty_text("category", self.category)
        if not isinstance(self.active, bool):
            raise TypeError("error.domain.active.not_bool")


@dataclass(frozen=True, slots=True, kw_only=True)
class Shift:
    id: UUID
    shift_date: date
    shift_type: ShiftType
    start_minute: MinuteOfDay
    end_minute: MinuteOfDay
    expected_sales_cents: MoneyCents
    sales_total_cents: MoneyCents
    orders_count: int

    def __post_init__(self) -> None:
        _require_minute_of_day("start_minute", self.start_minute)
        _require_minute_of_day("end_minute", self.end_minute)

        if self.end_minute <= self.start_minute:
            raise ValueError("error.domain.shift.invalid_time_range")

        _require_non_negative_int("orders_count", self.orders_count)


@dataclass(frozen=True, slots=True, kw_only=True)
class Order:
    id: UUID
    shift_id: UUID
    server_id: UUID
    menu_item_id: UUID
    subtotal_cents: MoneyCents
    tip_cents: MoneyCents


@dataclass(frozen=True, slots=True, kw_only=True)
class Assignment:
    id: UUID
    shift_id: UUID
    employee_id: UUID
    role: EmployeeRole
    minutes_worked: int
    assigned_sales_cents: MoneyCents
    tips_received_cents: MoneyCents

    def __post_init__(self) -> None:
        _require_positive_int("minutes_worked", self.minutes_worked)


@dataclass(frozen=True, slots=True, kw_only=True)
class EmployeeLatentProfile:
    """Hidden generator-only employee parameters.

    These values are ground truth used to synthesize realistic outcomes.
    They must never be exported into ML training rows or Prisma seed fixtures.

    learning_rate controls how quickly effective talent approaches talent_cap
    over worked shifts. It belongs to generator dynamics, not to the River model.
    """

    employee_id: UUID
    talent_base: float
    talent_cap: float
    learning_rate: float
    reliability: float

    def __post_init__(self) -> None:
        _require_finite_float("talent_base", self.talent_base)
        _require_finite_float("talent_cap", self.talent_cap)

        if self.talent_base <= 0.0:
            raise ValueError("error.domain.talent_base.not_positive")
        if self.talent_cap < self.talent_base:
            raise ValueError("error.domain.talent_cap.below_base")

        _require_unit_interval("learning_rate", self.learning_rate)
        _require_unit_interval("reliability", self.reliability)


@dataclass(frozen=True, slots=True, kw_only=True)
class ShiftLatentFactors:
    """Hidden generator-only shift parameters."""

    shift_id: UUID
    day_premium: float
    shift_type_premium: float
    noise_scale: float

    def __post_init__(self) -> None:
        _require_finite_float("day_premium", self.day_premium)
        _require_finite_float("shift_type_premium", self.shift_type_premium)
        _require_finite_float("noise_scale", self.noise_scale)

        if self.day_premium <= 0.0:
            raise ValueError("error.domain.day_premium.not_positive")
        if self.shift_type_premium <= 0.0:
            raise ValueError("error.domain.shift_type_premium.not_positive")
        if self.noise_scale < 0.0:
            raise ValueError("error.domain.noise_scale.negative")


@dataclass(frozen=True, slots=True, kw_only=True)
class ShiftWorkRecord:
    """Internal staffing record produced by shifts.py and consumed by tips.py.

    Not exported directly. shifts_worked_before is internal generator state.
    employee_index is the stable generation index used for deterministic RNG
    substreams; it is not a model feature.
    """

    shift_id: UUID
    employee_id: UUID
    employee_index: int
    role: EmployeeRole
    minutes_worked: int
    shifts_worked_before: int

    def __post_init__(self) -> None:
        _require_non_negative_int("employee_index", self.employee_index)
        _require_positive_int("minutes_worked", self.minutes_worked)
        _require_non_negative_int(
            "shifts_worked_before",
            self.shifts_worked_before,
        )


LatentDomainObject: TypeAlias = EmployeeLatentProfile | ShiftLatentFactors | ShiftWorkRecord

LATENT_TYPES: Final[tuple[type[object], ...]] = (
    EmployeeLatentProfile,
    ShiftLatentFactors,
    ShiftWorkRecord,
)


def assert_no_latent_values(obj: object) -> None:
    """Recursively fail if a latent object appears in an export payload.

    Writers must call this before serializing a dataset or a training row.
    This blocks accidental leaks through dataclasses, dicts, tuples, or lists.
    """
    if isinstance(obj, LATENT_TYPES):
        raise TypeError("error.domain.latent_leak")

    if isinstance(obj, dict):
        for value in obj.values():
            assert_no_latent_values(value)
        return

    if isinstance(obj, list | tuple | frozenset | set):
        for value in obj:
            assert_no_latent_values(value)
        return

    if is_dataclass(obj):
        for field in fields(obj):
            assert_no_latent_values(getattr(obj, field.name))


@dataclass(frozen=True, slots=True, kw_only=True)
class MlTrainingRow:
    """One row per (shift, employee): observable features only + target.

    No tenant_id, no talent_base/cap, no reliability, no noise.

    tenant_id belongs to dataset partitioning and file metadata, not to the ML
    feature matrix. Including it would let the model memorize tenant-specific
    behavior instead of learning generalizable restaurant patterns.
    """

    shift_id: UUID
    employee_id: UUID
    role: EmployeeRole
    shift_type: ShiftType
    day_of_week: int
    hour_start: int
    hour_end: int
    employee_count: int
    expected_sales_cents: MoneyCents
    sales_total_cents: MoneyCents
    assigned_sales_cents: MoneyCents
    orders_count: int
    tips_received_cents: MoneyCents

    def __post_init__(self) -> None:
        _require_day_of_week(self.day_of_week)
        _require_non_negative_int("hour_start", self.hour_start)
        _require_non_negative_int("hour_end", self.hour_end)

        if self.hour_start > 24 or self.hour_end > 24:
            raise ValueError("error.domain.hour.out_of_range")
        if self.hour_end <= self.hour_start:
            raise ValueError("error.domain.hour.invalid_range")

        _require_positive_int("employee_count", self.employee_count)
        _require_non_negative_int("orders_count", self.orders_count)
        assert_no_latent_values(self)


@dataclass(frozen=True, slots=True, kw_only=True)
class GeneratedDataset:
    tenant_id: UUID
    employees: tuple[Employee, ...]
    menu_items: tuple[MenuItem, ...]
    shifts: tuple[Shift, ...]
    orders: tuple[Order, ...]
    assignments: tuple[Assignment, ...]

    def __post_init__(self) -> None:
        if not self.employees:
            raise ValueError("error.domain.dataset.no_employees")
        if not self.menu_items:
            raise ValueError("error.domain.dataset.no_menu_items")
        if not self.shifts:
            raise ValueError("error.domain.dataset.no_shifts")

        assert_no_latent_values(self)
