from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
from typing import Any

from generator.config import GeneratorConfig
from generator.domain import GeneratedDataset
from generator.employees import generate_employees
from generator.menu import generate_menu
from generator.orders import generate_orders
from generator.patterns import bundle_for
from generator.shifts import generate_shifts
from generator.tips import generate_tips
from generator.writers.csv_writer import write_ml_training_csv
from generator.writers.json_writer import write_seed_json


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate deterministic SmartTips synthetic datasets.",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Master seed. Overrides GENERATOR_SEED when provided.",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory. Overrides GENERATOR_OUTPUT_DIR when provided.",
    )

    parser.add_argument(
        "--scenario",
        choices=("steady", "growth", "seasonal"),
        default=None,
        help="Scenario preset. Overrides GENERATOR_SCENARIO when provided.",
    )

    return parser


def build_dataset(config: GeneratorConfig) -> GeneratedDataset:
    bundle = bundle_for(config.scenario)

    employees, profiles = generate_employees(config, bundle)
    menu_items = generate_menu(config)
    shifts, work_records = generate_shifts(config, bundle, employees, profiles)
    orders = generate_orders(
        config,
        bundle,
        shifts,
        work_records,
        profiles,
        menu_items,
    )
    assignments = generate_tips(
        config,
        bundle,
        shifts,
        work_records,
        profiles,
        orders,
    )

    return GeneratedDataset(
        tenant_id=config.tenant_id,
        employees=employees,
        menu_items=menu_items,
        shifts=shifts,
        orders=orders,
        assignments=assignments,
    )


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    overrides: dict[str, Any] = {}

    if args.seed is not None:
        overrides["seed"] = args.seed

    if args.output_dir is not None:
        overrides["output_dir"] = args.output_dir

    if args.scenario is not None:
        overrides["scenario"] = args.scenario

    config = GeneratorConfig(**overrides)
    dataset = build_dataset(config)

    seed_json_path = write_seed_json(dataset, config.output_dir)
    training_csv_path = write_ml_training_csv(dataset, config.output_dir)

    seed_json_hash = _sha256_file(seed_json_path)
    training_csv_hash = _sha256_file(training_csv_path)

    print(f"seed_json={seed_json_path}")
    print(f"seed_json_sha256={seed_json_hash}")
    print(f"training_csv={training_csv_path}")
    print(f"training_csv_sha256={training_csv_hash}")


if __name__ == "__main__":
    main()
