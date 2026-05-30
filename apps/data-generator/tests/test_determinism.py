from __future__ import annotations

import csv
import hashlib
from collections import defaultdict
from pathlib import Path
from uuid import UUID

from generator.cli import build_dataset
from generator.config import GeneratorConfig
from generator.domain import EmployeeRole
from generator.writers.csv_writer import write_ml_training_csv
from generator.writers.json_writer import write_seed_json


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def _write_hashes(config: GeneratorConfig) -> tuple[str, str]:
    dataset = build_dataset(config)

    seed_json_path = write_seed_json(dataset, config.output_dir)
    training_csv_path = write_ml_training_csv(dataset, config.output_dir)

    return _sha256_file(seed_json_path), _sha256_file(training_csv_path)


def test_generation_outputs_are_deterministic_with_explicit_seed(
    tmp_path: Path,
) -> None:
    first = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "first")
    second = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "second")

    assert _write_hashes(first) == _write_hashes(second)


def test_generation_outputs_change_with_different_seed(tmp_path: Path) -> None:
    first = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "seed-42")
    second = GeneratorConfig(seed=43, days=2, output_dir=tmp_path / "seed-43")

    assert _write_hashes(first) != _write_hashes(second)


def test_build_dataset_is_deterministic_in_memory(tmp_path: Path) -> None:
    first = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "first")
    second = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "second")

    assert build_dataset(first) == build_dataset(second)


def test_generation_writes_non_empty_files(tmp_path: Path) -> None:
    config = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "run")
    dataset = build_dataset(config)

    seed_json_path = write_seed_json(dataset, config.output_dir)
    training_csv_path = write_ml_training_csv(dataset, config.output_dir)

    assert seed_json_path.exists()
    assert training_csv_path.exists()
    assert seed_json_path.stat().st_size > 0
    assert training_csv_path.stat().st_size > 0


def test_ml_csv_does_not_export_latent_or_tenant_features(tmp_path: Path) -> None:
    config = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "run")
    dataset = build_dataset(config)

    csv_path = write_ml_training_csv(dataset, config.output_dir)

    with csv_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)

        assert reader.fieldnames is not None

        forbidden_columns = {
            "tenant_id",
            "talent_base",
            "talent_cap",
            "learning_rate",
            "reliability",
            "shifts_worked_before",
            "employee_index",
        }

        assert forbidden_columns.isdisjoint(set(reader.fieldnames))


def test_financial_invariants_hold_end_to_end(tmp_path: Path) -> None:
    config = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "run")
    dataset = build_dataset(config)

    order_subtotal_by_shift: dict[UUID, int] = defaultdict(int)
    order_tip_by_shift: dict[UUID, int] = defaultdict(int)

    for order in dataset.orders:
        order_subtotal_by_shift[order.shift_id] += int(order.subtotal_cents)
        order_tip_by_shift[order.shift_id] += int(order.tip_cents)

    assignment_sales_by_shift: dict[UUID, int] = defaultdict(int)
    assignment_tip_by_shift: dict[UUID, int] = defaultdict(int)

    for assignment in dataset.assignments:
        assignment_sales_by_shift[assignment.shift_id] += int(
            assignment.assigned_sales_cents
        )
        assignment_tip_by_shift[assignment.shift_id] += int(
            assignment.tips_received_cents
        )

    shifts_with_orders = 0

    for shift in dataset.shifts:
        order_subtotal = order_subtotal_by_shift[shift.id]
        order_tip = order_tip_by_shift[shift.id]
        assignment_sales = assignment_sales_by_shift[shift.id]
        assignment_tip = assignment_tip_by_shift[shift.id]

        if order_subtotal > 0:
            shifts_with_orders += 1

        assert order_subtotal == int(shift.sales_total_cents)
        assert assignment_sales == int(shift.sales_total_cents)
        assert assignment_tip == order_tip

    assert shifts_with_orders > 0


def test_positive_sales_shifts_have_order_eligible_seller(tmp_path: Path) -> None:
    config = GeneratorConfig(seed=42, days=2, output_dir=tmp_path / "run")
    dataset = build_dataset(config)

    employee_role_by_id = {
        employee.id: employee.role
        for employee in dataset.employees
    }

    order_seller_by_shift: dict[UUID, set[UUID]] = defaultdict(set)

    for order in dataset.orders:
        order_seller_by_shift[order.shift_id].add(order.server_id)

    shifts_with_orders = 0

    for shift in dataset.shifts:
        if int(shift.sales_total_cents) <= 0:
            continue

        sellers = order_seller_by_shift[shift.id]

        assert sellers
        shifts_with_orders += 1
        assert all(
            employee_role_by_id[seller_id]
            in {EmployeeRole.SERVER, EmployeeRole.BARTENDER}
            for seller_id in sellers
        )

    assert shifts_with_orders > 0
