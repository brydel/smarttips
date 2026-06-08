from __future__ import annotations

import csv
import math
import re
from pathlib import Path

import pytest
from app.models.features import (
    FORBIDDEN_FEATURE_NAMES,
    POST_SHIFT_FEATURE_NAMES,
    to_post_shift_river_dict,
)


def valid_features() -> dict[str, object]:
    return {
        "role": "SERVER",
        "shift_type": "DINNER",
        "day_of_week": 4,
        "hour_start": 17,
        "hour_end": 23,
        "employee_count": 2,
        "expected_sales_cents": 90_00,
        "sales_total_cents": 100_00,
        "assigned_sales_cents": 60_00,
        "orders_count": 12,
    }


def test_tip_features_match_bis_27_observable_post_shift_columns() -> None:
    assert set(POST_SHIFT_FEATURE_NAMES) == {
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
    }

    assert to_post_shift_river_dict(valid_features()) == valid_features()


def test_tip_features_reject_missing_feature() -> None:
    features = valid_features()
    del features["assigned_sales_cents"]

    with pytest.raises(ValueError, match=re.escape("error.tip.features.missing")):
        to_post_shift_river_dict(features)


def test_tip_features_reject_unknown_feature() -> None:
    features = valid_features()
    features["employee_id"] = "not-a-feature"

    with pytest.raises(ValueError, match=re.escape("error.tip.features.unknown")):
        to_post_shift_river_dict(features)


def test_tip_features_reject_forbidden_feature() -> None:
    features = valid_features()
    features["tenant_id"] = "forbidden"

    with pytest.raises(ValueError, match=re.escape("error.tip.features.forbidden")):
        to_post_shift_river_dict(features)


def test_tip_features_reject_bool_before_int() -> None:
    features = valid_features()
    features["orders_count"] = True

    with pytest.raises(TypeError, match=re.escape("error.tip.features.bool_unsupported")):
        to_post_shift_river_dict(features)


@pytest.mark.parametrize("bad_value", [math.nan, math.inf, -math.inf])
def test_tip_features_reject_nan_and_inf(bad_value: float) -> None:
    features = valid_features()
    features["sales_total_cents"] = bad_value

    with pytest.raises(ValueError, match=re.escape("error.tip.features.float_not_finite")):
        to_post_shift_river_dict(features)


def test_real_ml_training_csv_does_not_contain_forbidden_tip_features() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    csv_path = repo_root / "data-generator" / "data" / "synthetic" / "ml-training.csv"

    with csv_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.reader(file)
        header = next(reader)

    assert FORBIDDEN_FEATURE_NAMES.isdisjoint(header)
