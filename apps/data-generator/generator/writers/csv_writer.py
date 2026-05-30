from __future__ import annotations

import csv
from pathlib import Path
from uuid import UUID

from generator.domain import (
    GeneratedDataset,
    MlTrainingRow,
    Shift,
    assert_no_latent_values,
)

_FIELDNAMES = (
    "shift_id",
    "employee_id",
    "role",
    "shift_type",
    "day_of_week",
    "hour_start",
    "hour_end",
    "employee_count",
    "expected_sales_cents",
    "sales_total_cents",
    "assigned_sales_cents",
    "orders_count",
    "tips_received_cents",
)


def _shifts_by_id(dataset: GeneratedDataset) -> dict[UUID, Shift]:
    return {shift.id: shift for shift in dataset.shifts}


def _employee_count_by_shift(dataset: GeneratedDataset) -> dict[UUID, int]:
    counts: dict[UUID, int] = {}

    for assignment in dataset.assignments:
        counts[assignment.shift_id] = counts.get(assignment.shift_id, 0) + 1

    return counts


def _ml_training_rows(dataset: GeneratedDataset) -> tuple[MlTrainingRow, ...]:
    assert_no_latent_values(dataset)

    shifts_by_id = _shifts_by_id(dataset)
    employee_count_by_shift = _employee_count_by_shift(dataset)

    assignments = sorted(
        dataset.assignments,
        key=lambda assignment: (
            shifts_by_id[assignment.shift_id].shift_date,
            shifts_by_id[assignment.shift_id].shift_type.value,
            str(assignment.shift_id),
            str(assignment.employee_id),
        ),
    )

    rows: list[MlTrainingRow] = []

    for assignment in assignments:
        shift = shifts_by_id[assignment.shift_id]

        rows.append(
            MlTrainingRow(
                shift_id=assignment.shift_id,
                employee_id=assignment.employee_id,
                role=assignment.role,
                shift_type=shift.shift_type,
                day_of_week=shift.shift_date.weekday(),
                hour_start=int(shift.start_minute) // 60,
                hour_end=int(shift.end_minute) // 60,
                employee_count=employee_count_by_shift[shift.id],
                expected_sales_cents=shift.expected_sales_cents,
                sales_total_cents=shift.sales_total_cents,
                assigned_sales_cents=assignment.assigned_sales_cents,
                orders_count=shift.orders_count,
                tips_received_cents=assignment.tips_received_cents,
            )
        )

    return tuple(rows)


def _row_to_dict(row: MlTrainingRow) -> dict[str, object]:
    return {
        "shift_id": str(row.shift_id),
        "employee_id": str(row.employee_id),
        "role": row.role.value,
        "shift_type": row.shift_type.value,
        "day_of_week": row.day_of_week,
        "hour_start": row.hour_start,
        "hour_end": row.hour_end,
        "employee_count": row.employee_count,
        "expected_sales_cents": int(row.expected_sales_cents),
        "sales_total_cents": int(row.sales_total_cents),
        "assigned_sales_cents": int(row.assigned_sales_cents),
        "orders_count": row.orders_count,
        "tips_received_cents": int(row.tips_received_cents),
    }


def write_ml_training_csv(
    dataset: GeneratedDataset,
    output_dir: Path,
    filename: str = "ml-training.csv",
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / filename

    rows = _ml_training_rows(dataset)

    with output_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=list(_FIELDNAMES),
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(_row_to_dict(row) for row in rows)

    return output_path
