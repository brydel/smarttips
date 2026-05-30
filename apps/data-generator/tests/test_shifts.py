import re
from datetime import date
from typing import Any
from uuid import UUID

import pytest
from generator.config import GeneratorConfig
from generator.domain import (
    Employee,
    EmployeeLatentProfile,
    EmployeeRole,
    ShiftType,
    ShiftWorkRecord,
)
from generator.employees import generate_employees
from generator.patterns import bundle_for
from generator.shifts import (
    _expected_average_bill_cents,
    _generate_shift_calendar,
    _present_employees,
    _sample_shift_sales_cents,
    _staff_target,
    _year_progress,
    generate_shifts,
)

EMPLOYEE_IDS = tuple(
    UUID(f"00000000-0000-0000-0000-{index:012d}")
    for index in range(1, 7)
)


def error_match(message: str) -> str:
    return re.escape(message)


class FixedLognormalStream:
    def __init__(self, value: float) -> None:
        self.value = value
        self.calls: list[tuple[float, float]] = []

    def lognormal(self, mean: float, sigma: float) -> float:
        self.calls.append((mean, sigma))
        return self.value


def config_for(
    *,
    seed: int = 42,
    start_date: date = date(2026, 1, 5),
    days: int = 2,
    employee_count: int = 6,
) -> GeneratorConfig:
    return GeneratorConfig(
        seed=seed,
        start_date=start_date,
        days=days,
        employee_count=employee_count,
    )


def employee_at(index: int, role: EmployeeRole = EmployeeRole.SERVER) -> Employee:
    return Employee(
        id=EMPLOYEE_IDS[index],
        first_name=f"First{index}",
        last_name=f"Last{index}",
        email=f"employee{index}@example.test",
        role=role,
        hired_at=date(2025, 1, 1),
    )


def profile_for(employee: Employee, reliability: float) -> EmployeeLatentProfile:
    return EmployeeLatentProfile(
        employee_id=employee.id,
        talent_base=0.9,
        talent_cap=1.2,
        learning_rate=0.02,
        reliability=reliability,
    )


def test_year_progress_uses_real_calendar_year_length() -> None:
    assert _year_progress(date(2026, 1, 1)) == 0.0
    assert _year_progress(date(2026, 12, 31)) == pytest.approx(364 / 365)
    assert _year_progress(date(2028, 12, 31)) == pytest.approx(365 / 366)


def test_generate_shift_calendar_skips_closed_mondays_and_sorts_lunch_before_dinner() -> None:
    calendar = _generate_shift_calendar(config_for(start_date=date(2026, 1, 5), days=2))

    assert calendar == [
        (date(2026, 1, 6), ShiftType.LUNCH),
        (date(2026, 1, 6), ShiftType.DINNER),
    ]


def test_sample_shift_sales_returns_zero_when_there_are_no_orders() -> None:
    stream: Any = FixedLognormalStream(10.0)

    assert _sample_shift_sales_cents(bundle_for("steady"), 0, 1.0, stream) == 0
    assert stream.calls == []


def test_sample_shift_sales_uses_unit_mean_lognormal_and_caps_outliers() -> None:
    bundle = bundle_for("steady")
    stream: Any = FixedLognormalStream(10.0)
    orders_count = 25

    sales = _sample_shift_sales_cents(bundle, orders_count, 1.2, stream)
    expected_without_random_spike = orders_count * _expected_average_bill_cents(bundle) * 1.2

    assert stream.calls == [
        (-(bundle.sales.bill_sigma / (orders_count**0.5)) ** 2 / 2.0, bundle.sales.bill_sigma / 5.0)
    ]
    assert sales == round(expected_without_random_spike * 3.0)


def test_staff_target_never_exceeds_employee_count() -> None:
    assert _staff_target(ShiftType.LUNCH, 3) == 3
    assert _staff_target(ShiftType.DINNER, 99) == 8


def test_present_employees_is_deterministic_and_fills_target_by_reliability() -> None:
    employees = tuple(employee_at(index) for index in range(6))
    employee_index_by_id = {
        employee.id: index
        for index, employee in enumerate(employees)
    }
    profiles = {
        employee.id: profile_for(employee, reliability=0.0)
        for employee in employees
    }
    profiles[employees[2].id] = profile_for(employees[2], reliability=0.9)
    profiles[employees[4].id] = profile_for(employees[4], reliability=0.8)
    profiles[employees[1].id] = profile_for(employees[1], reliability=0.7)

    present = _present_employees(
        employees,
        profiles,
        employee_index_by_id,
        target=3,
        seed=123,
        shift_index=0,
        require_seller=False,
    )

    assert present == _present_employees(
        employees,
        profiles,
        employee_index_by_id,
        3,
        123,
        0,
        False,
    )
    assert {employee.id for employee in present} == {
        employees[1].id,
        employees[2].id,
        employees[4].id,
    }


def test_present_employees_guarantees_at_least_one_order_eligible_worker() -> None:
    employees = (
        employee_at(0, EmployeeRole.SERVER),
        employee_at(1, EmployeeRole.BUSSER),
        employee_at(2, EmployeeRole.COOK),
        employee_at(3, EmployeeRole.HOST),
    )
    employee_index_by_id = {
        employee.id: index
        for index, employee in enumerate(employees)
    }
    profiles = {
        employees[0].id: profile_for(employees[0], reliability=0.0),
        employees[1].id: profile_for(employees[1], reliability=1.0),
        employees[2].id: profile_for(employees[2], reliability=1.0),
        employees[3].id: profile_for(employees[3], reliability=1.0),
    }

    present = _present_employees(employees, profiles, employee_index_by_id, 3, 123, 0, True)

    assert len(present) == 3
    assert any(employee.role is EmployeeRole.SERVER for employee in present)


def test_positive_sales_shift_has_at_least_one_order_eligible_seller() -> None:
    config = GeneratorConfig(seed=42)
    bundle = bundle_for(config.scenario)
    employees, profiles = generate_employees(config, bundle)

    shifts, records = generate_shifts(config, bundle, employees, profiles)

    roles_by_employee = {employee.id: employee.role for employee in employees}

    records_by_shift: dict[UUID, list[ShiftWorkRecord]] = {}
    for record in records:
        records_by_shift.setdefault(record.shift_id, []).append(record)

    for shift in shifts:
        if int(shift.sales_total_cents) <= 0:
            continue

        shift_records = records_by_shift.get(shift.id, [])

        assert any(
            roles_by_employee[record.employee_id]
            in {EmployeeRole.SERVER, EmployeeRole.BARTENDER}
            for record in shift_records
        )


def test_generate_shifts_returns_shifts_and_internal_work_records() -> None:
    config = config_for(seed=123, start_date=date(2026, 1, 5), days=2, employee_count=6)
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config, bundle)

    shifts, records = generate_shifts(config, bundle, employees, profiles)

    assert len(shifts) == 2
    assert [shift.shift_type for shift in shifts] == [ShiftType.LUNCH, ShiftType.DINNER]
    assert all(shift.shift_date == date(2026, 1, 6) for shift in shifts)
    assert all(shift.orders_count >= 0 for shift in shifts)
    assert all(shift.sales_total_cents >= 0 for shift in shifts)
    assert all(record.shift_id in {shift.id for shift in shifts} for record in records)
    assert all(record.minutes_worked in {240, 360} for record in records)

    worked_counts: dict[UUID, int] = {employee.id: 0 for employee in employees}
    index_by_id = {employee.id: index for index, employee in enumerate(employees)}
    for record in records:
        assert record.employee_index == index_by_id[record.employee_id]
        assert record.shifts_worked_before == worked_counts[record.employee_id]
        worked_counts[record.employee_id] += 1


def test_shift_work_records_carry_stable_employee_index() -> None:
    config = GeneratorConfig(seed=42)
    bundle = bundle_for(config.scenario)
    employees, profiles = generate_employees(config, bundle)

    _, records = generate_shifts(config, bundle, employees, profiles)

    index_by_id = {employee.id: index for index, employee in enumerate(employees)}

    assert all(
        record.employee_index == index_by_id[record.employee_id]
        for record in records
    )


def test_generate_shifts_rejects_missing_and_duplicate_profiles() -> None:
    config = config_for(employee_count=3)
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config, bundle)

    with pytest.raises(ValueError, match=error_match("error.shifts.profile_employee_mismatch")):
        generate_shifts(config, bundle, employees, profiles[:-1])

    duplicate_profiles = (profiles[0], profiles[0], profiles[1])
    with pytest.raises(ValueError, match=error_match("error.shifts.duplicate_profiles")):
        generate_shifts(config, bundle, employees, duplicate_profiles)


def test_generate_shifts_rejects_empty_employee_list() -> None:
    with pytest.raises(ValueError, match=error_match("error.shifts.no_employees")):
        generate_shifts(config_for(), bundle_for("steady"), (), ())
