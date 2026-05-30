from __future__ import annotations

import csv
import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

from app.models.distribution_allocation import allocate_cents
from app.models.distribution_features import (
    DISTRIBUTION_FEATURE_NAMES,
    FORBIDDEN_DISTRIBUTION_FEATURE_NAMES,
    to_distribution_river_dict,
)
from app.models.distribution_model import DistributionModelWrapper
from app.models.features import RiverFeatureDict


@dataclass(frozen=True, slots=True, kw_only=True)
class DistributionTrainingRow:
    shift_id: str
    employee_id: str
    features: RiverFeatureDict
    tips_received_cents: int

    def __post_init__(self) -> None:
        _validate_non_empty_str(self.shift_id, "shift_id")
        _validate_non_empty_str(self.employee_id, "employee_id")
        if isinstance(self.tips_received_cents, bool):
            raise TypeError("error.distribution.training.tips.bool_unsupported")
        if not isinstance(self.tips_received_cents, int):
            raise TypeError("error.distribution.training.tips.not_int")
        if self.tips_received_cents < 0:
            raise ValueError("error.distribution.training.tips.negative")
        if not self.features:
            raise ValueError("error.distribution.training.features.empty")


@dataclass(frozen=True, slots=True, kw_only=True)
class DistributionValidationMetrics:
    mae_cents: float
    mae_share: float
    examples_count: int
    shifts_count: int
    skipped_zero_pool_shifts: int

    def __post_init__(self) -> None:
        _validate_non_negative_finite(self.mae_cents, "mae_cents")
        _validate_non_negative_finite(self.mae_share, "mae_share")
        _validate_non_negative_int(self.examples_count, "examples_count")
        _validate_non_negative_int(self.shifts_count, "shifts_count")
        _validate_non_negative_int(
            self.skipped_zero_pool_shifts,
            "skipped_zero_pool_shifts",
        )


def load_distribution_training_csv(path: Path) -> tuple[DistributionTrainingRow, ...]:
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)

        if reader.fieldnames is None:
            raise ValueError("error.distribution.training.csv.header_missing")

        forbidden = set(reader.fieldnames) & FORBIDDEN_DISTRIBUTION_FEATURE_NAMES

        if forbidden:
            raise ValueError("error.distribution.training.csv.forbidden_feature")

        rows: list[DistributionTrainingRow] = []

        for raw_row in reader:
            feature_payload = {
                feature_name: _parse_feature_value(feature_name, raw_row[feature_name])
                for feature_name in DISTRIBUTION_FEATURE_NAMES
            }
            features = to_distribution_river_dict(feature_payload)

            rows.append(
                DistributionTrainingRow(
                    shift_id=raw_row["shift_id"],
                    employee_id=raw_row["employee_id"],
                    features=features,
                    tips_received_cents=_parse_cents(raw_row["tips_received_cents"]),
                )
            )

    return tuple(rows)


def learn_distribution_shift(
    model: DistributionModelWrapper,
    rows: Sequence[DistributionTrainingRow],
) -> int:
    if len(rows) == 0:
        raise ValueError("error.distribution.training.shift.empty")

    pool_cents = _pool_cents(rows)

    if pool_cents == 0:
        return 0

    for row in rows:
        target_share = row.tips_received_cents / pool_cents
        model.learn_share(row.features, target_share)

    return len(rows)


def progressive_validate_distribution(
    rows: Iterable[DistributionTrainingRow],
    model: DistributionModelWrapper,
) -> DistributionValidationMetrics:
    total_abs_cents_error = 0.0
    total_abs_share_error = 0.0
    examples_count = 0
    shifts_count = 0
    skipped_zero_pool_shifts = 0

    for shift_rows in _iter_shift_groups(rows):
        pool_cents = _pool_cents(shift_rows)

        if pool_cents == 0:
            skipped_zero_pool_shifts += 1
            continue

        # DECISION: share MAE compares normalized predicted shares, not raw weights.
        # Hamilton and the product both use weight_i / sum(weights) as the real share.
        weights = tuple(model.predict_weight(row.features) for row in shift_rows)
        total_weight = math.fsum(weights)
        predicted_shares = tuple(weight / total_weight for weight in weights)
        allocations = allocate_cents(pool_cents, weights)

        for row, allocation, predicted_share in zip(
            shift_rows,
            allocations,
            predicted_shares,
            strict=True,
        ):
            observed_share = row.tips_received_cents / pool_cents
            total_abs_cents_error += abs(allocation - row.tips_received_cents)
            total_abs_share_error += abs(predicted_share - observed_share)
            examples_count += 1

        learn_distribution_shift(model, shift_rows)
        shifts_count += 1

    if examples_count == 0:
        return DistributionValidationMetrics(
            mae_cents=0.0,
            mae_share=0.0,
            examples_count=0,
            shifts_count=shifts_count,
            skipped_zero_pool_shifts=skipped_zero_pool_shifts,
        )

    return DistributionValidationMetrics(
        mae_cents=total_abs_cents_error / examples_count,
        mae_share=total_abs_share_error / examples_count,
        examples_count=examples_count,
        shifts_count=shifts_count,
        skipped_zero_pool_shifts=skipped_zero_pool_shifts,
    )


def _iter_shift_groups(
    rows: Iterable[DistributionTrainingRow],
) -> Iterable[tuple[DistributionTrainingRow, ...]]:
    # ASSUMPTION: callers stream rows in chronological CSV order, already grouped by
    # shift_id as produced by BIS-27; this helper preserves that order and does not sort.
    current_shift_id: str | None = None
    current_rows: list[DistributionTrainingRow] = []

    for row in rows:
        if current_shift_id is None:
            current_shift_id = row.shift_id

        if row.shift_id != current_shift_id:
            yield tuple(current_rows)
            current_shift_id = row.shift_id
            current_rows = []

        current_rows.append(row)

    if current_rows:
        yield tuple(current_rows)


def _pool_cents(rows: Sequence[DistributionTrainingRow]) -> int:
    return sum(row.tips_received_cents for row in rows)


def _parse_feature_value(feature_name: str, value: str) -> object:
    if feature_name in {
        "day_of_week",
        "hour_start",
        "hour_end",
        "employee_count",
        "sales_total_cents",
        "assigned_sales_cents",
        "orders_count",
    }:
        return _parse_cents(value)

    return value


def _parse_cents(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as error:
        raise ValueError("error.distribution.training.csv.int_invalid") from error

    if parsed < 0:
        raise ValueError("error.distribution.training.csv.int_negative")

    return parsed


def _validate_non_empty_str(value: str, field_name: str) -> None:
    if not isinstance(value, str) or value.strip() == "":
        raise ValueError(f"error.distribution.training.{field_name}.empty")


def _validate_non_negative_int(value: int, field_name: str) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.distribution.training.{field_name}.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError(f"error.distribution.training.{field_name}.not_int")
    if value < 0:
        raise ValueError(f"error.distribution.training.{field_name}.negative")


def _validate_non_negative_finite(value: float, field_name: str) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.distribution.training.{field_name}.bool_unsupported")

    value_as_float = float(value)

    if not math.isfinite(value_as_float):
        raise ValueError(f"error.distribution.training.{field_name}.not_finite")
    if value_as_float < 0.0:
        raise ValueError(f"error.distribution.training.{field_name}.negative")
