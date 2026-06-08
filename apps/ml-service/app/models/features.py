import math
from collections.abc import Mapping
from enum import StrEnum
from typing import Final, TypeAlias

RiverFeatureValue: TypeAlias = int | float | str
RiverFeatureDict: TypeAlias = dict[str, RiverFeatureValue]


class ShiftType(StrEnum):
    LUNCH = "LUNCH"
    DINNER = "DINNER"


class EmployeeRole(StrEnum):
    SERVER = "SERVER"
    BARTENDER = "BARTENDER"
    BUSSER = "BUSSER"
    HOST = "HOST"
    COOK = "COOK"
    CHEF = "CHEF"


POST_SHIFT_FEATURE_NAMES: Final[tuple[str, ...]] = (
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
)

POST_SHIFT_FEATURE_SET: Final[frozenset[str]] = frozenset(POST_SHIFT_FEATURE_NAMES)

FORBIDDEN_FEATURE_NAMES: Final[frozenset[str]] = frozenset(
    {
        "tenant_id",
        "talent_base",
        "talent_cap",
        "learning_rate",
        "reliability",
        "shifts_worked_before",
        "employee_index",
    }
)

ALLOWED_ROLES: Final[frozenset[EmployeeRole]] = frozenset(EmployeeRole)
ALLOWED_SHIFT_TYPES: Final[frozenset[ShiftType]] = frozenset(ShiftType)


def to_post_shift_river_dict(features: Mapping[str, object]) -> RiverFeatureDict:
    return _to_river_dict(features=features)


def to_river_predict_dict(features: Mapping[str, object]) -> RiverFeatureDict:
    return to_post_shift_river_dict(features)


def to_river_train_dict(features: Mapping[str, object]) -> RiverFeatureDict:
    return to_post_shift_river_dict(features)


def _to_river_dict(*, features: Mapping[str, object]) -> RiverFeatureDict:
    unknown_features = set(features) - POST_SHIFT_FEATURE_SET

    if unknown_features:
        forbidden_features = unknown_features & FORBIDDEN_FEATURE_NAMES

        if forbidden_features:
            raise ValueError("error.tip.features.forbidden")

        raise ValueError("error.tip.features.unknown")

    missing_features = POST_SHIFT_FEATURE_SET - set(features)

    if missing_features:
        raise ValueError("error.tip.features.missing")

    return {
        feature_name: _normalize_feature_value(feature_name, features[feature_name])
        for feature_name in POST_SHIFT_FEATURE_NAMES
    }


def _normalize_feature_value(feature_name: str, value: object) -> RiverFeatureValue:
    if isinstance(value, EmployeeRole):
        if value not in ALLOWED_ROLES:
            raise ValueError("error.tip.features.role.unsupported")

        return str(value)

    if isinstance(value, ShiftType):
        if value not in ALLOWED_SHIFT_TYPES:
            raise ValueError("error.tip.features.shift_type.unsupported")

        return str(value)

    if isinstance(value, StrEnum):
        return str(value)

    if isinstance(value, bool):
        raise TypeError("error.tip.features.bool_unsupported")

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("error.tip.features.float_not_finite")

        return value

    if isinstance(value, str):
        normalized = value.strip()

        if normalized == "":
            raise ValueError("error.tip.features.string_empty")

        if feature_name == "role" and normalized not in {role.value for role in ALLOWED_ROLES}:
            raise ValueError("error.tip.features.role.unsupported")

        if (
            feature_name == "shift_type"
            and normalized not in {shift_type.value for shift_type in ALLOWED_SHIFT_TYPES}
        ):
            raise ValueError("error.tip.features.shift_type.unsupported")

        return normalized

    raise TypeError("error.tip.features.unsupported_type")
