from __future__ import annotations

import json
from datetime import date
from enum import StrEnum
from pathlib import Path
from typing import Any
from uuid import UUID

from generator.domain import (
    Assignment,
    Employee,
    GeneratedDataset,
    MenuItem,
    Order,
    Shift,
    assert_no_latent_values,
)


def _scalar(value: object) -> object:
    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, date):
        return value.isoformat()

    if isinstance(value, StrEnum):
        return value.value

    return value


def _employee_to_dict(employee: Employee) -> dict[str, object]:
    return {
        "id": _scalar(employee.id),
        "firstName": employee.first_name,
        "lastName": employee.last_name,
        "email": employee.email,
        "role": _scalar(employee.role),
        "hiredAt": _scalar(employee.hired_at),
    }


def _menu_item_to_dict(item: MenuItem) -> dict[str, object]:
    return {
        "id": _scalar(item.id),
        "name": item.name,
        "category": item.category,
        "basePriceCents": int(item.base_price_cents),
        "active": item.active,
    }


def _shift_to_dict(shift: Shift) -> dict[str, object]:
    return {
        "id": _scalar(shift.id),
        "shiftDate": _scalar(shift.shift_date),
        "shiftType": _scalar(shift.shift_type),
        "startMinute": int(shift.start_minute),
        "endMinute": int(shift.end_minute),
        "expectedSalesCents": int(shift.expected_sales_cents),
        "salesTotalCents": int(shift.sales_total_cents),
        "ordersCount": shift.orders_count,
    }


def _order_to_dict(order: Order) -> dict[str, object]:
    return {
        "id": _scalar(order.id),
        "shiftId": _scalar(order.shift_id),
        "serverId": _scalar(order.server_id),
        "menuItemId": _scalar(order.menu_item_id),
        "subtotalCents": int(order.subtotal_cents),
        "tipCents": int(order.tip_cents),
    }


def _assignment_to_dict(assignment: Assignment) -> dict[str, object]:
    return {
        "id": _scalar(assignment.id),
        "shiftId": _scalar(assignment.shift_id),
        "employeeId": _scalar(assignment.employee_id),
        "role": _scalar(assignment.role),
        "minutesWorked": assignment.minutes_worked,
        "assignedSalesCents": int(assignment.assigned_sales_cents),
        "tipsReceivedCents": int(assignment.tips_received_cents),
    }


def dataset_to_seed_payload(dataset: GeneratedDataset) -> dict[str, Any]:
    assert_no_latent_values(dataset)

    employees = sorted(dataset.employees, key=lambda employee: str(employee.id))
    menu_items = sorted(dataset.menu_items, key=lambda item: str(item.id))
    shifts = sorted(
        dataset.shifts,
        key=lambda shift: (shift.shift_date, shift.shift_type.value, str(shift.id)),
    )
    orders = sorted(dataset.orders, key=lambda order: str(order.id))
    assignments = sorted(dataset.assignments, key=lambda item: str(item.id))

    return {
        "metadata": {
            "version": 1,
            "tenantId": str(dataset.tenant_id),
            "counts": {
                "employees": len(employees),
                "menuItems": len(menu_items),
                "shifts": len(shifts),
                "orders": len(orders),
                "assignments": len(assignments),
            },
        },
        "tenant": {
            "id": str(dataset.tenant_id),
            "name": "SmartTips Synthetic Restaurant",
        },
        "employees": [_employee_to_dict(employee) for employee in employees],
        "menuItems": [_menu_item_to_dict(item) for item in menu_items],
        "shifts": [_shift_to_dict(shift) for shift in shifts],
        "orders": [_order_to_dict(order) for order in orders],
        "assignments": [
            _assignment_to_dict(assignment)
            for assignment in assignments
        ],
    }


def write_seed_json(
    dataset: GeneratedDataset,
    output_dir: Path,
    filename: str = "prisma-seed.json",
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / filename

    payload = dataset_to_seed_payload(dataset)

    output_path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
            separators=(",", ": "),
        )
        + "\n",
        encoding="utf-8",
    )

    return output_path
