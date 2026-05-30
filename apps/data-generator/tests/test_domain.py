import math
import re
from dataclasses import FrozenInstanceError, dataclass
from datetime import date
from typing import Any
from uuid import UUID

import pytest
from generator.domain import (
    Assignment,
    Employee,
    EmployeeLatentProfile,
    EmployeeRole,
    GeneratedDataset,
    MenuItem,
    MlTrainingRow,
    Order,
    Shift,
    ShiftLatentFactors,
    ShiftType,
    ShiftWorkRecord,
    assert_no_latent_values,
    minute_of_day,
    money_cents,
)

EMPLOYEE_ID = UUID("00000000-0000-0000-0000-000000000101")
MENU_ITEM_ID = UUID("00000000-0000-0000-0000-000000000102")
SHIFT_ID = UUID("00000000-0000-0000-0000-000000000103")
ORDER_ID = UUID("00000000-0000-0000-0000-000000000104")
ASSIGNMENT_ID = UUID("00000000-0000-0000-0000-000000000105")
TENANT_ID = UUID("00000000-0000-0000-0000-000000000106")


def error_match(message: str) -> str:
    return re.escape(message)


def set_attribute(obj: object, field_name: str, value: object) -> None:
    setattr(obj, field_name, value)


def build_employee(**overrides: Any) -> Employee:
    values: dict[str, Any] = {
        "id": EMPLOYEE_ID,
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "ada@example.test",
        "role": EmployeeRole.SERVER,
        "hired_at": date(2026, 1, 1),
    }
    values.update(overrides)
    return Employee(**values)


def build_menu_item(**overrides: Any) -> MenuItem:
    values: dict[str, Any] = {
        "id": MENU_ITEM_ID,
        "name": "Poutine",
        "category": "Mains",
        "base_price_cents": money_cents(1299),
        "active": True,
    }
    values.update(overrides)
    return MenuItem(**values)


def build_shift(**overrides: Any) -> Shift:
    values: dict[str, Any] = {
        "id": SHIFT_ID,
        "shift_date": date(2026, 1, 2),
        "shift_type": ShiftType.DINNER,
        "start_minute": minute_of_day(17 * 60),
        "end_minute": minute_of_day(23 * 60),
        "expected_sales_cents": money_cents(250_000),
        "sales_total_cents": money_cents(263_500),
        "orders_count": 42,
    }
    values.update(overrides)
    return Shift(**values)


def build_order(**overrides: Any) -> Order:
    values: dict[str, Any] = {
        "id": ORDER_ID,
        "shift_id": SHIFT_ID,
        "server_id": EMPLOYEE_ID,
        "menu_item_id": MENU_ITEM_ID,
        "subtotal_cents": money_cents(4_200),
        "tip_cents": money_cents(840),
    }
    values.update(overrides)
    return Order(**values)


def build_assignment(**overrides: Any) -> Assignment:
    values: dict[str, Any] = {
        "id": ASSIGNMENT_ID,
        "shift_id": SHIFT_ID,
        "employee_id": EMPLOYEE_ID,
        "role": EmployeeRole.SERVER,
        "minutes_worked": 360,
        "assigned_sales_cents": money_cents(50_000),
        "tips_received_cents": money_cents(10_000),
    }
    values.update(overrides)
    return Assignment(**values)


def build_employee_latent_profile(**overrides: Any) -> EmployeeLatentProfile:
    values: dict[str, Any] = {
        "employee_id": EMPLOYEE_ID,
        "talent_base": 0.9,
        "talent_cap": 1.25,
        "learning_rate": 0.02,
        "reliability": 0.95,
    }
    values.update(overrides)
    return EmployeeLatentProfile(**values)


def build_shift_latent_factors(**overrides: Any) -> ShiftLatentFactors:
    values: dict[str, Any] = {
        "shift_id": SHIFT_ID,
        "day_premium": 1.05,
        "shift_type_premium": 1.2,
        "noise_scale": 0.15,
    }
    values.update(overrides)
    return ShiftLatentFactors(**values)


def build_shift_work_record(**overrides: Any) -> ShiftWorkRecord:
    values: dict[str, Any] = {
        "shift_id": SHIFT_ID,
        "employee_id": EMPLOYEE_ID,
        "employee_index": 0,
        "role": EmployeeRole.SERVER,
        "minutes_worked": 360,
        "shifts_worked_before": 0,
    }
    values.update(overrides)
    return ShiftWorkRecord(**values)


def build_training_row(**overrides: Any) -> MlTrainingRow:
    values: dict[str, Any] = {
        "shift_id": SHIFT_ID,
        "employee_id": EMPLOYEE_ID,
        "role": EmployeeRole.SERVER,
        "shift_type": ShiftType.DINNER,
        "day_of_week": 4,
        "hour_start": 17,
        "hour_end": 23,
        "employee_count": 8,
        "expected_sales_cents": money_cents(250_000),
        "sales_total_cents": money_cents(263_500),
        "assigned_sales_cents": money_cents(50_000),
        "orders_count": 42,
        "tips_received_cents": money_cents(10_000),
    }
    values.update(overrides)
    return MlTrainingRow(**values)


def build_dataset(**overrides: Any) -> GeneratedDataset:
    values: dict[str, Any] = {
        "tenant_id": TENANT_ID,
        "employees": (build_employee(),),
        "menu_items": (build_menu_item(),),
        "shifts": (build_shift(),),
        "orders": (build_order(),),
        "assignments": (build_assignment(),),
    }
    values.update(overrides)
    return GeneratedDataset(**values)


def test_money_cents_accepts_zero_and_positive_values() -> None:
    assert money_cents(0) == 0
    assert money_cents(1_500) == 1_500


@pytest.mark.parametrize(
    ("value", "error_type", "message"),
    [
        (True, TypeError, "error.money.bool_unsupported"),
        ("100", TypeError, "error.money.not_int"),
        (-1, ValueError, "error.money.negative"),
    ],
)
def test_money_cents_rejects_unsafe_values(
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        money_cents(value)  # type: ignore[arg-type]


def test_minute_of_day_accepts_closed_service_day_bounds() -> None:
    assert minute_of_day(0) == 0
    assert minute_of_day(24 * 60) == 24 * 60


@pytest.mark.parametrize(
    ("value", "error_type", "message"),
    [
        (False, TypeError, "error.time.bool_unsupported"),
        ("600", TypeError, "error.time.not_int"),
        (-1, ValueError, "error.time.minute_of_day.out_of_range"),
        (24 * 60 + 1, ValueError, "error.time.minute_of_day.out_of_range"),
    ],
)
def test_minute_of_day_rejects_unsafe_values(
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        minute_of_day(value)  # type: ignore[arg-type]


def test_domain_objects_are_keyword_only_frozen_and_slotted() -> None:
    employee = build_employee()
    employee_type: Any = Employee
    positional_args: tuple[Any, ...] = (
        EMPLOYEE_ID,
        "Ada",
        "Lovelace",
        "ada@example.test",
        EmployeeRole.SERVER,
        date(2026, 1, 1),
    )

    with pytest.raises(TypeError):
        employee_type(*positional_args)

    with pytest.raises(FrozenInstanceError):
        set_attribute(employee, "first_name", "Grace")

    with pytest.raises(TypeError):
        set_attribute(employee, "nickname", "Countess")


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("first_name", "", ValueError, "error.domain.first_name.empty"),
        ("last_name", "   ", ValueError, "error.domain.last_name.empty"),
        ("email", 123, TypeError, "error.domain.email.not_string"),
    ],
)
def test_employee_rejects_invalid_required_text(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_employee(**{field: value})


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("name", "", ValueError, "error.domain.name.empty"),
        ("category", 123, TypeError, "error.domain.category.not_string"),
        ("active", 1, TypeError, "error.domain.active.not_bool"),
    ],
)
def test_menu_item_rejects_invalid_public_fields(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_menu_item(**{field: value})


@pytest.mark.parametrize(
    ("overrides", "error_type", "message"),
    [
        ({"start_minute": True}, TypeError, "error.domain.start_minute.bool_unsupported"),
        ({"end_minute": "1380"}, TypeError, "error.domain.end_minute.not_int"),
        ({"end_minute": 24 * 60 + 1}, ValueError, "error.domain.end_minute.out_of_range"),
        (
            {"start_minute": minute_of_day(600), "end_minute": minute_of_day(600)},
            ValueError,
            "error.domain.shift.invalid_time_range",
        ),
        ({"orders_count": False}, TypeError, "error.domain.orders_count.bool_unsupported"),
        ({"orders_count": -1}, ValueError, "error.domain.orders_count.negative"),
    ],
)
def test_shift_rejects_invalid_time_range_and_counts(
    overrides: dict[str, object],
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_shift(**overrides)


@pytest.mark.parametrize(
    ("value", "error_type", "message"),
    [
        (True, TypeError, "error.domain.minutes_worked.bool_unsupported"),
        ("360", TypeError, "error.domain.minutes_worked.not_int"),
        (0, ValueError, "error.domain.minutes_worked.not_positive"),
        (-1, ValueError, "error.domain.minutes_worked.not_positive"),
    ],
)
def test_assignment_requires_positive_minutes_worked(
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_assignment(minutes_worked=value)


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("talent_base", True, TypeError, "error.domain.talent_base.bool_unsupported"),
        ("talent_base", math.inf, ValueError, "error.domain.talent_base.not_finite"),
        ("talent_base", 0.0, ValueError, "error.domain.talent_base.not_positive"),
        ("talent_cap", math.nan, ValueError, "error.domain.talent_cap.not_finite"),
        ("talent_cap", 0.8, ValueError, "error.domain.talent_cap.below_base"),
        ("reliability", -0.01, ValueError, "error.domain.reliability.out_of_range"),
        ("reliability", 1.01, ValueError, "error.domain.reliability.out_of_range"),
        ("learning_rate", math.nan, ValueError, "error.domain.learning_rate.not_finite"),
        ("learning_rate", -0.01, ValueError, "error.domain.learning_rate.out_of_range"),
        ("learning_rate", 1.01, ValueError, "error.domain.learning_rate.out_of_range"),
    ],
)
def test_employee_latent_profile_rejects_unsafe_hidden_parameters(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_employee_latent_profile(**{field: value})


def test_employee_latent_profile_allows_cap_above_one() -> None:
    profile = build_employee_latent_profile(talent_base=1.2, talent_cap=2.4)

    assert profile.talent_base == 1.2
    assert profile.talent_cap == 2.4


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("day_premium", 0.0, ValueError, "error.domain.day_premium.not_positive"),
        ("shift_type_premium", -1.0, ValueError, "error.domain.shift_type_premium.not_positive"),
        ("noise_scale", -0.01, ValueError, "error.domain.noise_scale.negative"),
        ("noise_scale", math.inf, ValueError, "error.domain.noise_scale.not_finite"),
    ],
)
def test_shift_latent_factors_reject_invalid_hidden_parameters(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_shift_latent_factors(**{field: value})


def test_shift_work_record_accepts_first_shift_and_positive_minutes() -> None:
    record = build_shift_work_record(minutes_worked=1, shifts_worked_before=0)

    assert record.shift_id == SHIFT_ID
    assert record.employee_id == EMPLOYEE_ID
    assert record.employee_index == 0
    assert record.role is EmployeeRole.SERVER
    assert record.minutes_worked == 1
    assert record.shifts_worked_before == 0


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("minutes_worked", True, TypeError, "error.domain.minutes_worked.bool_unsupported"),
        ("minutes_worked", "360", TypeError, "error.domain.minutes_worked.not_int"),
        ("minutes_worked", 0, ValueError, "error.domain.minutes_worked.not_positive"),
        ("minutes_worked", -1, ValueError, "error.domain.minutes_worked.not_positive"),
        ("employee_index", True, TypeError, "error.domain.employee_index.bool_unsupported"),
        ("employee_index", "0", TypeError, "error.domain.employee_index.not_int"),
        ("employee_index", -1, ValueError, "error.domain.employee_index.negative"),
        (
            "shifts_worked_before",
            False,
            TypeError,
            "error.domain.shifts_worked_before.bool_unsupported",
        ),
        (
            "shifts_worked_before",
            "0",
            TypeError,
            "error.domain.shifts_worked_before.not_int",
        ),
        (
            "shifts_worked_before",
            -1,
            ValueError,
            "error.domain.shifts_worked_before.negative",
        ),
    ],
)
def test_shift_work_record_rejects_invalid_work_facts(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_shift_work_record(**{field: value})


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("day_of_week", True, TypeError, "error.domain.day_of_week.bool_unsupported"),
        ("day_of_week", 7, ValueError, "error.domain.day_of_week.out_of_range"),
        ("hour_start", -1, ValueError, "error.domain.hour_start.negative"),
        ("hour_end", 25, ValueError, "error.domain.hour.out_of_range"),
        ("hour_start", 23, ValueError, "error.domain.hour.invalid_range"),
        ("employee_count", 0, ValueError, "error.domain.employee_count.not_positive"),
        ("orders_count", -1, ValueError, "error.domain.orders_count.negative"),
    ],
)
def test_training_row_rejects_invalid_observable_features(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_training_row(**{field: value})


def test_latent_guard_allows_safe_export_payloads() -> None:
    assert_no_latent_values(
        {
            "dataset": build_dataset(),
            "training_rows": [build_training_row()],
            "metadata": ("public", frozenset({"observable"})),
        }
    )


def test_latent_guard_rejects_hidden_values_nested_in_containers() -> None:
    latent = build_employee_latent_profile()

    with pytest.raises(TypeError, match=error_match("error.domain.latent_leak")):
        assert_no_latent_values({"employees": [{"hidden": (latent,)}]})


def test_latent_guard_rejects_hidden_values_nested_in_dataclasses() -> None:
    @dataclass(frozen=True)
    class ExportEnvelope:
        payload: object

    envelope = ExportEnvelope(payload=build_shift_latent_factors())

    with pytest.raises(TypeError, match=error_match("error.domain.latent_leak")):
        assert_no_latent_values(envelope)


def test_latent_guard_rejects_shift_work_records() -> None:
    with pytest.raises(TypeError, match=error_match("error.domain.latent_leak")):
        assert_no_latent_values({"work_records": [build_shift_work_record()]})


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("employees", (), "error.domain.dataset.no_employees"),
        ("menu_items", (), "error.domain.dataset.no_menu_items"),
        ("shifts", (), "error.domain.dataset.no_shifts"),
    ],
)
def test_generated_dataset_requires_core_collections(
    field: str,
    value: object,
    message: str,
) -> None:
    with pytest.raises(ValueError, match=error_match(message)):
        build_dataset(**{field: value})


def test_generated_dataset_rejects_latent_objects_before_export() -> None:
    with pytest.raises(TypeError, match=error_match("error.domain.latent_leak")):
        build_dataset(assignments=(build_assignment(), build_employee_latent_profile()))
