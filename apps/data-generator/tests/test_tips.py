import re
from datetime import date
from typing import Any
from uuid import UUID

import pytest
from generator._ids import order_id
from generator.config import GeneratorConfig
from generator.domain import (
    EmployeeLatentProfile,
    EmployeeRole,
    Order,
    Shift,
    ShiftType,
    ShiftWorkRecord,
    minute_of_day,
    money_cents,
)
from generator.patterns import bundle_for
from generator.tips import generate_tips

SHIFT_ID = UUID("00000000-0000-0000-0000-000000000201")
SERVER_ID = UUID("00000000-0000-0000-0000-000000000202")
BUSSER_ID = UUID("00000000-0000-0000-0000-000000000203")
MENU_ITEM_ID = UUID("00000000-0000-0000-0000-000000000204")


def error_match(message: str) -> str:
    return re.escape(message)


def config_for() -> GeneratorConfig:
    return GeneratorConfig(seed=42)


def build_shift(**overrides: object) -> Shift:
    values: dict[str, Any] = {
        "id": SHIFT_ID,
        "shift_date": date(2026, 1, 6),
        "shift_type": ShiftType.DINNER,
        "start_minute": minute_of_day(17 * 60),
        "end_minute": minute_of_day(23 * 60),
        "expected_sales_cents": money_cents(10_000),
        "sales_total_cents": money_cents(10_000),
        "orders_count": 2,
    }
    values.update(overrides)
    return Shift(**values)


def build_records() -> tuple[ShiftWorkRecord, ...]:
    return (
        ShiftWorkRecord(
            shift_id=SHIFT_ID,
            employee_id=SERVER_ID,
            employee_index=0,
            role=EmployeeRole.SERVER,
            minutes_worked=360,
            shifts_worked_before=0,
        ),
        ShiftWorkRecord(
            shift_id=SHIFT_ID,
            employee_id=BUSSER_ID,
            employee_index=1,
            role=EmployeeRole.BUSSER,
            minutes_worked=360,
            shifts_worked_before=0,
        ),
    )


def build_profiles() -> tuple[EmployeeLatentProfile, ...]:
    return (
        EmployeeLatentProfile(
            employee_id=SERVER_ID,
            talent_base=1.0,
            talent_cap=1.0,
            learning_rate=0.0,
            reliability=1.0,
        ),
        EmployeeLatentProfile(
            employee_id=BUSSER_ID,
            talent_base=1.0,
            talent_cap=1.0,
            learning_rate=0.0,
            reliability=1.0,
        ),
    )


def build_orders(config: GeneratorConfig) -> tuple[Order, ...]:
    return (
        Order(
            id=order_id(config.tenant_id, SHIFT_ID, 0),
            shift_id=SHIFT_ID,
            server_id=SERVER_ID,
            menu_item_id=MENU_ITEM_ID,
            subtotal_cents=money_cents(6_000),
            tip_cents=money_cents(1_200),
        ),
        Order(
            id=order_id(config.tenant_id, SHIFT_ID, 1),
            shift_id=SHIFT_ID,
            server_id=SERVER_ID,
            menu_item_id=MENU_ITEM_ID,
            subtotal_cents=money_cents(4_000),
            tip_cents=money_cents(800),
        ),
    )


def test_generate_tips_derives_assigned_sales_and_tip_pool_from_orders() -> None:
    config = config_for()
    assignments = generate_tips(
        config,
        bundle_for("steady"),
        (build_shift(),),
        build_records(),
        build_profiles(),
        build_orders(config),
    )

    by_employee = {assignment.employee_id: assignment for assignment in assignments}

    assert by_employee[SERVER_ID].assigned_sales_cents == 10_000
    assert by_employee[BUSSER_ID].assigned_sales_cents == 0
    assert sum(int(assignment.tips_received_cents) for assignment in assignments) == 2_000
    assert by_employee[BUSSER_ID].tips_received_cents > 0


def test_generate_tips_rejects_when_order_sales_do_not_match_shift_sales() -> None:
    config = config_for()
    with pytest.raises(ValueError, match=error_match("error.tips.assigned_sales_mismatch")):
        generate_tips(
            config,
            bundle_for("steady"),
            (build_shift(sales_total_cents=money_cents(123)),),
            build_records(),
            build_profiles(),
            build_orders(config),
        )


def test_generate_tips_rejects_order_from_employee_not_working_shift() -> None:
    config = config_for()
    bad_order = Order(
        id=order_id(config.tenant_id, SHIFT_ID, 99),
        shift_id=SHIFT_ID,
        server_id=UUID("00000000-0000-0000-0000-000000000999"),
        menu_item_id=MENU_ITEM_ID,
        subtotal_cents=money_cents(10_000),
        tip_cents=money_cents(2_000),
    )

    with pytest.raises(ValueError, match=error_match("error.tips.order_server_not_present")):
        generate_tips(
            config,
            bundle_for("steady"),
            (build_shift(),),
            build_records(),
            build_profiles(),
            (bad_order,),
        )
