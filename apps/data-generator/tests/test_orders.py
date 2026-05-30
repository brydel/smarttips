import re
from collections import defaultdict
from datetime import date
from uuid import UUID

import pytest
from generator._ids import menu_item_id, shift_id
from generator.config import GeneratorConfig
from generator.domain import (
    EmployeeLatentProfile,
    EmployeeRole,
    MenuItem,
    Shift,
    ShiftType,
    ShiftWorkRecord,
    minute_of_day,
    money_cents,
)
from generator.employees import generate_employees
from generator.menu import generate_menu
from generator.orders import ORDER_ELIGIBLE_ROLES, generate_orders
from generator.patterns import bundle_for
from generator.shifts import generate_shifts


def error_match(message: str) -> str:
    return re.escape(message)


def config_for(seed: int = 42) -> GeneratorConfig:
    return GeneratorConfig(seed=seed, start_date=date(2026, 1, 6), days=1, employee_count=12)


def controlled_order_fixture() -> tuple[
    GeneratorConfig,
    Shift,
    tuple[ShiftWorkRecord, ...],
    tuple[EmployeeLatentProfile, ...],
    tuple[MenuItem, ...],
]:
    config = GeneratorConfig(seed=42, start_date=date(2026, 1, 6), days=1, employee_count=2)
    current_shift_id = shift_id(config.tenant_id, config.start_date, ShiftType.DINNER.value)
    strong_seller_id = UUID("00000000-0000-0000-0000-000000000301")
    weak_seller_id = UUID("00000000-0000-0000-0000-000000000302")
    current_shift = Shift(
        id=current_shift_id,
        shift_date=config.start_date,
        shift_type=ShiftType.DINNER,
        start_minute=minute_of_day(17 * 60),
        end_minute=minute_of_day(23 * 60),
        expected_sales_cents=money_cents(100_000),
        sales_total_cents=money_cents(100_000),
        orders_count=200,
    )
    records = (
        ShiftWorkRecord(
            shift_id=current_shift_id,
            employee_id=strong_seller_id,
            employee_index=0,
            role=EmployeeRole.SERVER,
            minutes_worked=360,
            shifts_worked_before=0,
        ),
        ShiftWorkRecord(
            shift_id=current_shift_id,
            employee_id=weak_seller_id,
            employee_index=1,
            role=EmployeeRole.SERVER,
            minutes_worked=360,
            shifts_worked_before=0,
        ),
    )
    profiles = (
        EmployeeLatentProfile(
            employee_id=strong_seller_id,
            talent_base=1.0,
            talent_cap=1.0,
            learning_rate=0.0,
            reliability=1.0,
        ),
        EmployeeLatentProfile(
            employee_id=weak_seller_id,
            talent_base=0.05,
            talent_cap=0.05,
            learning_rate=0.0,
            reliability=1.0,
        ),
    )
    menu_items = (
        MenuItem(
            id=menu_item_id(config.tenant_id, 0),
            name="Burger",
            category="Mains",
            base_price_cents=money_cents(1800),
        ),
    )

    return config, current_shift, records, profiles, menu_items


def test_generate_orders_is_deterministic_and_financially_matches_shifts() -> None:
    config = config_for(seed=123)
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config, bundle)
    shifts, records = generate_shifts(config, bundle, employees, profiles)
    menu_items = generate_menu(config, bundle)

    orders = generate_orders(config, bundle, shifts, records, profiles, menu_items)

    assert orders == generate_orders(config, bundle, shifts, records, profiles, menu_items)

    orders_by_shift: dict[UUID, list[int]] = defaultdict(list)
    tips_by_shift: dict[UUID, list[int]] = defaultdict(list)
    for order in orders:
        orders_by_shift[order.shift_id].append(int(order.subtotal_cents))
        tips_by_shift[order.shift_id].append(int(order.tip_cents))

    for shift in shifts:
        assert len(orders_by_shift[shift.id]) == shift.orders_count
        assert sum(orders_by_shift[shift.id]) == int(shift.sales_total_cents)
        assert sum(tips_by_shift[shift.id]) >= 0


def test_order_subtotals_match_shift_sales() -> None:
    config = config_for(seed=126)
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config, bundle)
    shifts, records = generate_shifts(config, bundle, employees, profiles)
    orders = generate_orders(
        config,
        bundle,
        shifts,
        records,
        profiles,
        generate_menu(config, bundle),
    )

    subtotal_by_shift: defaultdict[UUID, int] = defaultdict(int)

    for order in orders:
        subtotal_by_shift[order.shift_id] += int(order.subtotal_cents)

    for shift in shifts:
        if shift.orders_count > 0:
            assert subtotal_by_shift[shift.id] == int(shift.sales_total_cents)


def test_orders_only_assigned_to_sellers() -> None:
    config = config_for(seed=124)
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config, bundle)
    shifts, records = generate_shifts(config, bundle, employees, profiles)
    menu_items = generate_menu(config, bundle)

    orders = generate_orders(config, bundle, shifts, records, profiles, menu_items)
    record_by_shift_employee = {
        (record.shift_id, record.employee_id): record
        for record in records
    }

    assert orders
    for order in orders:
        record = record_by_shift_employee[(order.shift_id, order.server_id)]
        assert record.role in ORDER_ELIGIBLE_ROLES


def test_generate_orders_references_existing_menu_items() -> None:
    config = config_for(seed=125)
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config, bundle)
    shifts, records = generate_shifts(config, bundle, employees, profiles)
    menu_items = generate_menu(config, bundle)

    orders = generate_orders(config, bundle, shifts, records, profiles, menu_items)

    assert orders
    assert {order.menu_item_id for order in orders}.issubset({item.id for item in menu_items})


def test_generate_orders_rejects_no_menu_items() -> None:
    config = config_for()
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config, bundle)
    shifts, records = generate_shifts(config, bundle, employees, profiles)

    with pytest.raises(ValueError, match=error_match("error.orders.no_menu_items")):
        generate_orders(config, bundle, shifts, records, profiles, ())


def test_generate_orders_weights_sellers_by_effective_talent() -> None:
    config, current_shift, records, profiles, menu_items = controlled_order_fixture()

    orders = generate_orders(
        config,
        bundle_for("steady"),
        (current_shift,),
        records,
        profiles,
        menu_items,
    )
    orders_by_seller: defaultdict[UUID, int] = defaultdict(int)

    for order in orders:
        orders_by_seller[order.server_id] += 1

    assert orders_by_seller[records[0].employee_id] > 180
    assert orders_by_seller[records[0].employee_id] > orders_by_seller[records[1].employee_id]
