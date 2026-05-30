from __future__ import annotations

from typing import Final, cast
from uuid import UUID

import numpy as np

from generator import rng
from generator._alloc import allocate_cents
from generator._ids import order_id
from generator.config import GeneratorConfig
from generator.domain import (
    EmployeeLatentProfile,
    EmployeeRole,
    MenuItem,
    Order,
    Shift,
    ShiftType,
    ShiftWorkRecord,
    money_cents,
)
from generator.patterns import ScenarioBundle, effective_talent

_ORDER_ELIGIBLE_ROLES: Final[frozenset[EmployeeRole]] = frozenset(
    {
        EmployeeRole.SERVER,
        EmployeeRole.BARTENDER,
    }
)
ORDER_ELIGIBLE_ROLES: Final = _ORDER_ELIGIBLE_ROLES

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


def _sellers_for_shift(
    shift_records: list[ShiftWorkRecord],
) -> list[ShiftWorkRecord]:
    sellers = [
        record for record in shift_records
        if record.role in _ORDER_ELIGIBLE_ROLES
    ]

    if not sellers:
        raise ValueError("error.orders.shift.no_eligible_seller")

    return sorted(sellers, key=lambda record: str(record.employee_id))


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


def _validate_inputs(
    shifts: tuple[Shift, ...],
    records: tuple[ShiftWorkRecord, ...],
    profiles: tuple[EmployeeLatentProfile, ...],
    menu_items: tuple[MenuItem, ...],
) -> dict[UUID, EmployeeLatentProfile]:
    if not shifts:
        raise ValueError("error.orders.no_shifts")

    if not menu_items:
        raise ValueError("error.orders.no_menu_items")

    shift_ids = {shift.id for shift in shifts}
    record_shift_ids = {record.shift_id for record in records}

    if not record_shift_ids.issubset(shift_ids):
        raise ValueError("error.orders.record_shift_mismatch")

    profiles_by_id: dict[UUID, EmployeeLatentProfile] = {
        profile.employee_id: profile for profile in profiles
    }

    if len(profiles_by_id) != len(profiles):
        raise ValueError("error.orders.duplicate_profiles")

    record_employee_ids = {record.employee_id for record in records}
    profile_ids = set(profiles_by_id.keys())

    if not record_employee_ids.issubset(profile_ids):
        raise ValueError("error.orders.profile_employee_mismatch")

    return profiles_by_id


def _seller_weights(
    sellers: list[ShiftWorkRecord],
    profiles_by_id: dict[UUID, EmployeeLatentProfile],
) -> list[float]:
    weights: list[float] = []

    for seller in sellers:
        profile = profiles_by_id[seller.employee_id]

        talent = effective_talent(
            profile.talent_base,
            profile.learning_rate,
            profile.talent_cap,
            seller.shifts_worked_before,
        )

        weights.append(talent)

    return weights


def _order_tip_weights(
    bundle: ScenarioBundle,
    subtotals: tuple[int, ...],
    tip_stream: np.random.Generator,
) -> list[float]:
    tips = bundle.tips
    rates = tip_stream.normal(tips.rate_mu, tips.rate_sigma, size=len(subtotals))

    return [
        subtotal * float(min(max(rate, tips.rate_floor), tips.rate_ceiling))
        for subtotal, rate in zip(subtotals, rates, strict=True)
    ]


def generate_orders(
    config: GeneratorConfig,
    bundle: ScenarioBundle,
    shifts: tuple[Shift, ...],
    records: tuple[ShiftWorkRecord, ...],
    profiles: tuple[EmployeeLatentProfile, ...],
    menu_items: tuple[MenuItem, ...],
) -> tuple[Order, ...]:
    profiles_by_id = _validate_inputs(shifts, records, profiles, menu_items)

    records_by_shift = _records_by_shift(records)
    ordered_shifts = _ordered_shifts(shifts)

    orders: list[Order] = []

    for shift_index, shift in enumerate(ordered_shifts):
        order_count = shift.orders_count

        if order_count <= 0:
            continue

        shift_records = records_by_shift.get(shift.id, [])
        sellers = _sellers_for_shift(shift_records)

        sales_total_cents = int(shift.sales_total_cents)

        subtotal_stream = rng.order_subtotal_stream(config.seed, shift_index)
        menu_stream = rng.order_menu_stream(config.seed, shift_index)
        server_stream = rng.order_server_stream(config.seed, shift_index)
        tip_stream = rng.order_tip_stream(config.seed, shift_index)

        subtotal_weights = cast(
            "list[float]",
            subtotal_stream.lognormal(
                mean=0.0,
                sigma=bundle.sales.bill_sigma,
                size=order_count,
            ).tolist(),
        )

        subtotals = allocate_cents(
            sales_total_cents,
            subtotal_weights,
        )

        tip_weights = _order_tip_weights(
            bundle,
            subtotals,
            tip_stream,
        )

        tip_pool_cents = round(sum(tip_weights))
        order_tips = allocate_cents(
            tip_pool_cents,
            tip_weights,
        )

        seller_weights = _seller_weights(sellers, profiles_by_id)
        seller_probabilities = np.array(seller_weights, dtype=float)
        seller_weight_total = float(seller_probabilities.sum())

        if seller_weight_total <= 0.0:
            raise ValueError("error.orders.seller_weights.empty")

        seller_probabilities = seller_probabilities / seller_weight_total

        seller_indices = server_stream.choice(
            len(sellers),
            size=order_count,
            p=seller_probabilities,
        )

        menu_indices = menu_stream.integers(
            0,
            len(menu_items),
            size=order_count,
        )

        for order_index in range(order_count):
            seller = sellers[int(seller_indices[order_index])]
            menu_item = menu_items[int(menu_indices[order_index])]

            orders.append(
                Order(
                    id=order_id(config.tenant_id, shift.id, order_index),
                    shift_id=shift.id,
                    server_id=seller.employee_id,
                    menu_item_id=menu_item.id,
                    subtotal_cents=money_cents(subtotals[order_index]),
                    tip_cents=money_cents(order_tips[order_index]),
                )
            )

    return tuple(orders)
