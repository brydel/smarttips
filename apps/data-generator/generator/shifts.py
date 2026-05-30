from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Final
from uuid import UUID

import numpy as np

from generator import rng
from generator._ids import shift_id
from generator.config import GeneratorConfig
from generator.domain import (
    Employee,
    EmployeeLatentProfile,
    EmployeeRole,
    Shift,
    ShiftType,
    ShiftWorkRecord,
    minute_of_day,
    money_cents,
)
from generator.patterns import ScenarioBundle, seasonal_multiplier

_SHIFT_ORDINAL: Final[dict[ShiftType, int]] = {
    ShiftType.LUNCH: 0,
    ShiftType.DINNER: 1,
}

_WINDOWS: Final[dict[ShiftType, tuple[int, int]]] = {
    ShiftType.LUNCH: (11 * 60, 15 * 60),
    ShiftType.DINNER: (17 * 60, 23 * 60),
}

_CLOSED_WEEKDAYS: Final[frozenset[int]] = frozenset({0})

_STAFF_TARGET: Final[dict[ShiftType, int]] = {
    ShiftType.LUNCH: 5,
    ShiftType.DINNER: 8,
}

_ORDER_ELIGIBLE_ROLES: Final[frozenset[EmployeeRole]] = frozenset(
    {
        EmployeeRole.SERVER,
        EmployeeRole.BARTENDER,
    }
)


def _year_progress(day: date) -> float:
    """Return normalized progress through the real calendar year in [0.0, 1.0)."""
    year_start = date(day.year, 1, 1)
    next_year_start = date(day.year + 1, 1, 1)
    elapsed_days = (day - year_start).days
    year_days = (next_year_start - year_start).days

    return elapsed_days / year_days


def _expected_average_bill_cents(bundle: ScenarioBundle) -> int:
    sales = bundle.sales
    mean_dollars = math.exp(sales.bill_mu + (sales.bill_sigma**2) / 2.0)

    return round(mean_dollars * 100)


def _sample_shift_sales_cents(
    bundle: ScenarioBundle,
    orders_count: int,
    season_multiplier_value: float,
    stream: np.random.Generator,
) -> int:
    if orders_count <= 0:
        return 0

    expected_avg_bill_cents = _expected_average_bill_cents(bundle)

    sigma = bundle.sales.bill_sigma / math.sqrt(orders_count)

    # Lognormal with expected multiplier ~= 1.
    # mean = -sigma² / 2 makes E[lognormal(mean, sigma)] = 1.
    avg_ticket_multiplier = float(
        stream.lognormal(
            mean=-(sigma**2) / 2.0,
            sigma=sigma,
        )
    )

    # Defensive cap: allows realistic spikes but prevents pathological outliers
    # from dominating the synthetic dataset.
    avg_ticket_multiplier = min(avg_ticket_multiplier, 3.0)

    sales_cents = orders_count * expected_avg_bill_cents * season_multiplier_value
    sales_cents *= avg_ticket_multiplier

    return max(0, round(sales_cents))


def _generate_shift_calendar(config: GeneratorConfig) -> list[tuple[date, ShiftType]]:
    calendar: list[tuple[date, ShiftType]] = []

    for offset in range(config.days):
        day = config.start_date + timedelta(days=offset)

        if day.weekday() in _CLOSED_WEEKDAYS:
            continue

        for shift_type in (ShiftType.LUNCH, ShiftType.DINNER):
            calendar.append((day, shift_type))

    calendar.sort(key=lambda item: (item[0], _SHIFT_ORDINAL[item[1]]))

    return calendar


def _validate_inputs(
    employees: tuple[Employee, ...],
    profiles: tuple[EmployeeLatentProfile, ...],
) -> dict[UUID, EmployeeLatentProfile]:
    if not employees:
        raise ValueError("error.shifts.no_employees")

    profiles_by_id: dict[UUID, EmployeeLatentProfile] = {
        profile.employee_id: profile for profile in profiles
    }

    employee_ids = {employee.id for employee in employees}
    profile_ids = set(profiles_by_id.keys())

    if len(profiles_by_id) != len(profiles):
        raise ValueError("error.shifts.duplicate_profiles")

    if employee_ids != profile_ids:
        raise ValueError("error.shifts.profile_employee_mismatch")

    return profiles_by_id


def _staff_target(shift_type: ShiftType, employee_count: int) -> int:
    target = _STAFF_TARGET[shift_type]

    return min(target, employee_count)


def _present_employees(
    employees: tuple[Employee, ...],
    profiles_by_id: dict[UUID, EmployeeLatentProfile],
    employee_index_by_id: dict[UUID, int],
    target: int,
    seed: int,
    shift_index: int,
    require_seller: bool,
) -> list[Employee]:
    ordered_employees = tuple(sorted(employees, key=lambda employee: str(employee.id)))

    present: list[Employee] = []

    for employee in ordered_employees:
        stable_employee_index = employee_index_by_id[employee.id]

        attendance_stream = rng.shift_attendance_stream(
            seed,
            shift_index,
            stable_employee_index,
        )

        if attendance_stream.random() < profiles_by_id[employee.id].reliability:
            present.append(employee)

    if require_seller and not any(
        employee.role in _ORDER_ELIGIBLE_ROLES for employee in present
    ):
        eligible_sellers = [
            employee
            for employee in ordered_employees
            if employee.role in _ORDER_ELIGIBLE_ROLES and employee not in present
        ]

        if not eligible_sellers:
            raise ValueError("error.shifts.no_eligible_seller_available")

        best_seller = sorted(
            eligible_sellers,
            key=lambda employee: (
                -profiles_by_id[employee.id].reliability,
                str(employee.id),
            ),
        )[0]

        present.append(best_seller)

    if len(present) < target:
        absent = sorted(
            (employee for employee in ordered_employees if employee not in present),
            key=lambda employee: (
                -profiles_by_id[employee.id].reliability,
                str(employee.id),
            ),
        )

        present.extend(absent[: target - len(present)])

    if len(present) > target:
        sellers = [
            employee for employee in present if employee.role in _ORDER_ELIGIBLE_ROLES
        ]

        if require_seller and sellers:
            kept_seller = sorted(
                sellers,
                key=lambda employee: (
                    -profiles_by_id[employee.id].reliability,
                    str(employee.id),
                ),
            )[0]
            remaining_candidates = [
                employee for employee in present if employee.id != kept_seller.id
            ]
            present = sorted(
                remaining_candidates,
                key=lambda employee: (
                    -profiles_by_id[employee.id].reliability,
                    str(employee.id),
                ),
            )[: max(0, target - 1)]
            present = [kept_seller, *present]
        else:
            present = sorted(
                present,
                key=lambda employee: (
                    -profiles_by_id[employee.id].reliability,
                    str(employee.id),
                ),
            )[:target]

    return sorted(present, key=lambda employee: str(employee.id))


def generate_shifts(
    config: GeneratorConfig,
    bundle: ScenarioBundle,
    employees: tuple[Employee, ...],
    profiles: tuple[EmployeeLatentProfile, ...],
) -> tuple[tuple[Shift, ...], tuple[ShiftWorkRecord, ...]]:
    profiles_by_id = _validate_inputs(employees, profiles)
    employee_index_by_id: dict[UUID, int] = {
        employee.id: index for index, employee in enumerate(employees)
    }
    calendar = _generate_shift_calendar(config)

    worked_so_far: dict[UUID, int] = {
        employee.id: 0 for employee in employees
    }

    shifts: list[Shift] = []
    records: list[ShiftWorkRecord] = []

    for shift_index, (day, shift_type) in enumerate(calendar):
        sales_stream = rng.shift_sales_stream(config.seed, shift_index)
        current_shift_id = shift_id(config.tenant_id, day, shift_type.value)

        orders_lambda = (
            bundle.sales.dinner_orders_lambda
            if shift_type is ShiftType.DINNER
            else bundle.sales.lunch_orders_lambda
        )

        orders_count = int(sales_stream.poisson(orders_lambda))
        season = seasonal_multiplier(bundle.seasonal, _year_progress(day))
        sales_total_cents = _sample_shift_sales_cents(
            bundle,
            orders_count,
            season,
            sales_stream,
        )

        forecast_noise = float(
            sales_stream.normal(0.0, bundle.sales.forecast_noise)
        )
        expected_sales_cents = max(
            0,
            round(sales_total_cents * (1.0 + forecast_noise)),
        )

        start_minute, end_minute = _WINDOWS[shift_type]

        shifts.append(
            Shift(
                id=current_shift_id,
                shift_date=day,
                shift_type=shift_type,
                start_minute=minute_of_day(start_minute),
                end_minute=minute_of_day(end_minute),
                expected_sales_cents=money_cents(expected_sales_cents),
                sales_total_cents=money_cents(sales_total_cents),
                orders_count=orders_count,
            )
        )

        present = _present_employees(
            employees=employees,
            profiles_by_id=profiles_by_id,
            employee_index_by_id=employee_index_by_id,
            target=_staff_target(shift_type, len(employees)),
            seed=config.seed,
            shift_index=shift_index,
            require_seller=sales_total_cents > 0,
        )

        shift_minutes = end_minute - start_minute

        for employee in present:
            records.append(
                ShiftWorkRecord(
                    shift_id=current_shift_id,
                    employee_id=employee.id,
                    employee_index=employee_index_by_id[employee.id],
                    role=employee.role,
                    minutes_worked=shift_minutes,
                    shifts_worked_before=worked_so_far[employee.id],
                )
            )

            worked_so_far[employee.id] += 1

    return tuple(shifts), tuple(records)
