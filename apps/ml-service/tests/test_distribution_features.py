from __future__ import annotations

import csv
import re
from pathlib import Path

import pytest
from app.models.distribution_features import (
    DISTRIBUTION_FEATURE_NAMES,
    FORBIDDEN_DISTRIBUTION_FEATURE_NAMES,
    to_distribution_river_dict,
)


def valid_features() -> dict[str, object]:
    return {
        "role": "SERVER",
        "shift_type": "DINNER",
        "day_of_week": 4,
        "hour_start": 17,
        "hour_end": 23,
        "employee_count": 2,
        "sales_total_cents": 100_00,
        "assigned_sales_cents": 60_00,
        "orders_count": 12,
    }


def test_distribution_features_allow_only_post_shift_distribution_columns() -> None:
    assert set(DISTRIBUTION_FEATURE_NAMES) == {
        "role",
        "shift_type",
        "day_of_week",
        "hour_start",
        "hour_end",
        "employee_count",
        "sales_total_cents",
        "assigned_sales_cents",
        "orders_count",
    }


def test_distribution_features_reject_forbidden_feature() -> None:
    features = valid_features()
    features["tenant_id"] = "forbidden"

    with pytest.raises(
        ValueError,
        match=re.escape("error.distribution.features.forbidden"),
    ):
        to_distribution_river_dict(features)


def test_distribution_features_reject_bool_before_int() -> None:
    features = valid_features()
    features["orders_count"] = True

    with pytest.raises(
        TypeError,
        match=re.escape("error.distribution.features.bool_unsupported"),
    ):
        to_distribution_river_dict(features)


def test_real_ml_training_csv_does_not_contain_forbidden_distribution_features() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    csv_path = repo_root / "data-generator" / "data" / "synthetic" / "ml-training.csv"

    with csv_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.reader(file)
        header = next(reader)

    assert FORBIDDEN_DISTRIBUTION_FEATURE_NAMES.isdisjoint(header)
