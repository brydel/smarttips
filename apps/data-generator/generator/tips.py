from __future__ import annotations

from typing import Final
from uuid import UUID

from generator import rng
from generator._alloc import allocate_cents
from generator._ids import assignment_id
from generator.config import GeneratorConfig
from generator.domain import (
    Assignment,
    EmployeeLatentProfile,
    Order,
    Shift,
    ShiftType,
    ShiftWorkRecord,
    money_cents,
)
from generator.patterns import (
    ScenarioBundle,
    effective_talent,
    shift_premium,
    weekend_premium,
)

_SHIFT_ORDINAL: Final[dict[ShiftType, int]] = {
    ShiftType.LUNCH: 0,
    ShiftType.DINNER: 1,
}


def _records_by_shift(
    records: tuple[ShiftWorkRecord, ...],
) -> dict[UUID, list[ShiftWorkRecord]]:
    grouped: dict[UUID, list[ShiftWorkRecord]] = {}

    for record in records:
        grouped.setdefault(record.shift_id, []).append(record)

    for shift_records in grouped.values():
        shift_records.sort(key=lambda record: str(record.employee_id))

    return grouped


def _orders_aggregates(
    orders: tuple[Order, ...],
) -> tuple[dict[UUID, dict[UUID, int]], dict[UUID, int]]:
    """Derive financial truth from orders.

    Returns:
    - assigned_sales[shift_id][server_id] = Σ subtotal_cents for that seller
    - tip_pool[shift_id] = Σ tip_cents for the whole shift
    """
    assigned_sales: dict[UUID, dict[UUID, int]] = {}
    tip_pool: dict[UUID, int] = {}

    for order in orders:
        shift_id = order.shift_id

        assigned_sales.setdefault(shift_id, {})
        assigned_sales[shift_id][order.server_id] = (
            assigned_sales[shift_id].get(order.server_id, 0)
            + int(order.subtotal_cents)
        )

        tip_pool[shift_id] = tip_pool.get(shift_id, 0) + int(order.tip_cents)

    return assigned_sales, tip_pool


def _validate_inputs(
    shifts: tuple[Shift, ...],
    records: tuple[ShiftWorkRecord, ...],
    profiles: tuple[EmployeeLatentProfile, ...],
    orders: tuple[Order, ...],
) -> dict[UUID, EmployeeLatentProfile]:
    if not shifts:
        raise ValueError("error.tips.no_shifts")

    profiles_by_id: dict[UUID, EmployeeLatentProfile] = {
        profile.employee_id: profile for profile in profiles
    }

    if len(profiles_by_id) != len(profiles):
        raise ValueError("error.tips.duplicate_profiles")

    record_employee_ids = {record.employee_id for record in records}

    if not record_employee_ids.issubset(set(profiles_by_id)):
        raise ValueError("error.tips.profile_employee_mismatch")

    shift_ids = {shift.id for shift in shifts}
    record_shift_ids = {record.shift_id for record in records}

    if not record_shift_ids.issubset(shift_ids):
        raise ValueError("error.tips.record_shift_mismatch")

    order_shift_ids = {order.shift_id for order in orders}

    if not order_shift_ids.issubset(shift_ids):
        raise ValueError("error.tips.order_shift_mismatch")

    record_pairs = {
        (record.shift_id, record.employee_id)
        for record in records
    }

    order_pairs = {
        (order.shift_id, order.server_id)
        for order in orders
    }

    if not order_pairs.issubset(record_pairs):
        raise ValueError("error.tips.order_server_not_present")

    return profiles_by_id


def _ordered_shifts(shifts: tuple[Shift, ...]) -> tuple[Shift, ...]:
    return tuple(
        sorted(
            shifts,
            key=lambda shift: (
                shift.shift_date,
                _SHIFT_ORDINAL[shift.shift_type],
                str(shift.id),
            ),
        )
    )


def _tip_weights(
    config: GeneratorConfig,
    bundle: ScenarioBundle,
    shift: Shift,
    shift_index: int,
    shift_records: list[ShiftWorkRecord],
    assigned_for_shift: dict[UUID, int],
    profiles_by_id: dict[UUID, EmployeeLatentProfile],
) -> list[float]:
    tips = bundle.tips
    shift_multiplier = shift_premium(bundle, shift.shift_type)
    weekend_multiplier = weekend_premium(bundle, shift.shift_date.weekday())
    sales_total_cents = int(shift.sales_total_cents)

    weights: list[float] = []

    for record in shift_records:
        profile = profiles_by_id[record.employee_id]

        talent = effective_talent(
            profile.talent_base,
            profile.learning_rate,
            profile.talent_cap,
            record.shifts_worked_before,
        )

        employee_sales_cents = assigned_for_shift.get(record.employee_id, 0)
        sales_share = (
            employee_sales_cents / sales_total_cents
            if sales_total_cents > 0
            else 0.0
        )

        sigma = tips.noise_sigma

        if sigma > 0.0:
            noise_stream = rng.tip_noise_stream(
                config.seed,
                shift_index,
                record.employee_index,
            )
            noise = float(
                noise_stream.lognormal(
                    mean=-(sigma**2) / 2.0,
                    sigma=sigma,
                )
            )
        else:
            noise = 1.0

        base_role_weight = tips.base_role_weights.for_role(record.role)

        weight = (
            (base_role_weight + tips.sales_share_weight * sales_share)
            * talent
            * shift_multiplier
            * weekend_multiplier
            * noise
        )

        weights.append(weight)

    return weights


def generate_tips(
    config: GeneratorConfig,
    bundle: ScenarioBundle,
    shifts: tuple[Shift, ...],
    records: tuple[ShiftWorkRecord, ...],
    profiles: tuple[EmployeeLatentProfile, ...],
    orders: tuple[Order, ...],
) -> tuple[Assignment, ...]:
    profiles_by_id = _validate_inputs(shifts, records, profiles, orders)
    records_by_shift = _records_by_shift(records)
    assigned_sales, tip_pool = _orders_aggregates(orders)
    ordered_shifts = _ordered_shifts(shifts)

    assignments: list[Assignment] = []

    for shift_index, shift in enumerate(ordered_shifts):
        shift_records = records_by_shift.get(shift.id, [])

        if not shift_records:
            continue

        assigned_for_shift = assigned_sales.get(shift.id, {})
        assigned_total = sum(assigned_for_shift.values())

        if assigned_total != int(shift.sales_total_cents):
            raise ValueError("error.tips.assigned_sales_mismatch")

        pool_cents = tip_pool.get(shift.id, 0)

        weights = _tip_weights(
            config=config,
            bundle=bundle,
            shift=shift,
            shift_index=shift_index,
            shift_records=shift_records,
            assigned_for_shift=assigned_for_shift,
            profiles_by_id=profiles_by_id,
        )

        if pool_cents > 0 and not any(weight > 0.0 for weight in weights):
            raise ValueError("error.tips.weights.all_zero")

        tip_cents = allocate_cents(pool_cents, weights)

        for record, employee_tip_cents in zip(
            shift_records,
            tip_cents,
            strict=True,
        ):
            employee_sales_cents = assigned_for_shift.get(record.employee_id, 0)

            assignments.append(
                Assignment(
                    id=assignment_id(
                        config.tenant_id,
                        shift.id,
                        record.employee_id,
                    ),
                    shift_id=shift.id,
                    employee_id=record.employee_id,
                    role=record.role,
                    minutes_worked=record.minutes_worked,
                    assigned_sales_cents=money_cents(employee_sales_cents),
                    tips_received_cents=money_cents(employee_tip_cents),
                )
            )

    return tuple(assignments)