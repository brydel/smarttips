from collections.abc import Mapping
from enum import StrEnum
from types import MappingProxyType
from typing import Final, TypeAlias

RiverFeatureValue: TypeAlias = int | float | str
RiverFeatureDict: TypeAlias = dict[str, RiverFeatureValue]


class ShiftType(StrEnum):
    LUNCH = "LUNCH"
    DINNER = "DINNER"


COMMON_FEATURE_NAMES: Final[tuple[str, ...]] = (
    "day_of_week",
    "hour_start",
    "hour_end",
    "shift_type",
    "employee_count",
)

PREDICT_FEATURE_NAMES: Final[tuple[str, ...]] = (
    *COMMON_FEATURE_NAMES,
    "expected_sales",
    "expected_orders",
)

TRAIN_FEATURE_NAMES: Final[tuple[str, ...]] = (
    *COMMON_FEATURE_NAMES,
    "sales_total",
    "orders_count",
)

PREDICT_FEATURE_SET: Final[frozenset[str]] = frozenset(PREDICT_FEATURE_NAMES)
TRAIN_FEATURE_SET: Final[frozenset[str]] = frozenset(TRAIN_FEATURE_NAMES)

FEATURE_ALIASES: Final[Mapping[str, str]] = MappingProxyType(
    {
        "expected_sales": "sales_signal",
        "sales_total": "sales_signal",
        "expected_orders": "orders_signal",
        "orders_count": "orders_signal",
    }
)


def to_river_predict_dict(features: Mapping[str, object]) -> RiverFeatureDict:
    return _to_river_dict(
        features=features,
        allowed_features=PREDICT_FEATURE_SET,
    )


def to_river_train_dict(features: Mapping[str, object]) -> RiverFeatureDict:
    return _to_river_dict(
        features=features,
        allowed_features=TRAIN_FEATURE_SET,
    )


def _to_river_dict(
    *,
    features: Mapping[str, object],
    allowed_features: frozenset[str],
) -> RiverFeatureDict:
    unknown_features = set(features) - allowed_features

    if unknown_features:
        sorted_unknown = ", ".join(sorted(unknown_features))
        raise ValueError(f"Unknown ML feature(s): {sorted_unknown}")

    missing_features = allowed_features - set(features)

    if missing_features:
        sorted_missing = ", ".join(sorted(missing_features))
        raise ValueError(f"Missing ML feature(s): {sorted_missing}")

    river_features: RiverFeatureDict = {}

    for feature_name in allowed_features:
        raw_value = features[feature_name]
        river_feature_name = FEATURE_ALIASES.get(feature_name, feature_name)
        river_features[river_feature_name] = _normalize_feature_value(raw_value)

    return river_features


def _normalize_feature_value(value: object) -> RiverFeatureValue:
    if isinstance(value, StrEnum):
        return str(value)

    if isinstance(value, bool):
        raise TypeError("Boolean values are not valid ML feature values")

    if isinstance(value, int | float | str):
        return value

    raise TypeError(f"Unsupported ML feature value type: {type(value).__name__}")
