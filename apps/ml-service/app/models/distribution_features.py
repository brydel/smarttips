from __future__ import annotations

import math
from collections.abc import Mapping
from enum import StrEnum
from typing import Final, TypeAlias

from app.models.features import RiverFeatureDict, RiverFeatureValue, ShiftType

DistributionFeatureValue: TypeAlias = int | float | str | StrEnum


class EmployeeRole(StrEnum):
    SERVER = "SERVER"
    BARTENDER = "BARTENDER"
    BUSSER = "BUSSER"
    HOST = "HOST"
    COOK = "COOK"
    CHEF = "CHEF"


DISTRIBUTION_FEATURE_NAMES: Final[tuple[str, ...]] = (
    "role",
    "shift_type",
    "day_of_week",
    "hour_start",
    "hour_end",
    "employee_count",
    "sales_total_cents",
    "assigned_sales_cents",
    "orders_count",
)

DISTRIBUTION_FEATURE_SET: Final[frozenset[str]] = frozenset(DISTRIBUTION_FEATURE_NAMES)

FORBIDDEN_DISTRIBUTION_FEATURE_NAMES: Final[frozenset[str]] = frozenset(
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


def to_distribution_river_dict(features: Mapping[str, object]) -> RiverFeatureDict:
    unknown_features = set(features) - DISTRIBUTION_FEATURE_SET

    if unknown_features:
        if unknown_features & FORBIDDEN_DISTRIBUTION_FEATURE_NAMES:
            raise ValueError("error.distribution.features.forbidden")

        raise ValueError("error.distribution.features.unknown")

    missing_features = DISTRIBUTION_FEATURE_SET - set(features)

    if missing_features:
        raise ValueError("error.distribution.features.missing")

    return {
        feature_name: _normalize_feature_value(feature_name, features[feature_name])
        for feature_name in DISTRIBUTION_FEATURE_NAMES
    }


def _normalize_feature_value(feature_name: str, value: object) -> RiverFeatureValue:
    if isinstance(value, EmployeeRole):
        if value not in ALLOWED_ROLES:
            raise ValueError("error.distribution.features.role.unsupported")

        return str(value)

    if isinstance(value, ShiftType):
        if value not in ALLOWED_SHIFT_TYPES:
            raise ValueError("error.distribution.features.shift_type.unsupported")

        return str(value)

    if isinstance(value, StrEnum):
        return str(value)

    if isinstance(value, bool):
        raise TypeError("error.distribution.features.bool_unsupported")

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("error.distribution.features.float_not_finite")

        return value

    if isinstance(value, str):
        normalized = value.strip()

        if normalized == "":
            raise ValueError("error.distribution.features.string_empty")

        if feature_name == "role" and normalized not in {role.value for role in ALLOWED_ROLES}:
            raise ValueError("error.distribution.features.role.unsupported")

        if (
            feature_name == "shift_type"
            and normalized not in {shift_type.value for shift_type in ALLOWED_SHIFT_TYPES}
        ):
            raise ValueError("error.distribution.features.shift_type.unsupported")

        return normalized

    raise TypeError("error.distribution.features.unsupported_type")
