from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass

from app.models.features import RiverFeatureDict
from app.models.tip_model import TipModelWrapper


@dataclass(frozen=True, slots=True, kw_only=True)
class TipTrainingRow:
    features: RiverFeatureDict
    tips_received_cents: int

    def __post_init__(self) -> None:
        if not self.features:
            raise ValueError("error.tip.training.features.empty")
        _validate_non_negative_int(self.tips_received_cents, "tips_received_cents")


@dataclass(frozen=True, slots=True, kw_only=True)
class TipValidationMetrics:
    mae_cents: float
    mae_dollars: float
    rmse_cents: float
    rmse_dollars: float
    examples_count: int

    def __post_init__(self) -> None:
        _validate_non_negative_finite(self.mae_cents, "mae_cents")
        _validate_non_negative_finite(self.mae_dollars, "mae_dollars")
        _validate_non_negative_finite(self.rmse_cents, "rmse_cents")
        _validate_non_negative_finite(self.rmse_dollars, "rmse_dollars")
        _validate_non_negative_int(self.examples_count, "examples_count")


def progressive_validate_tips(
    rows: Iterable[TipTrainingRow],
    model: TipModelWrapper,
) -> TipValidationMetrics:
    total_abs_error_cents = 0.0
    total_squared_error_cents = 0.0
    examples_count = 0

    for row in rows:
        prediction_cents = model.predict(row.features)
        error_cents = prediction_cents - row.tips_received_cents

        total_abs_error_cents += abs(error_cents)
        total_squared_error_cents += error_cents * error_cents
        examples_count += 1

        model.learn(row.features, row.tips_received_cents)

    if examples_count == 0:
        return TipValidationMetrics(
            mae_cents=0.0,
            mae_dollars=0.0,
            rmse_cents=0.0,
            rmse_dollars=0.0,
            examples_count=0,
        )

    mae_cents = total_abs_error_cents / examples_count
    rmse_cents = math.sqrt(total_squared_error_cents / examples_count)

    return TipValidationMetrics(
        mae_cents=mae_cents,
        mae_dollars=mae_cents / 100.0,
        rmse_cents=rmse_cents,
        rmse_dollars=rmse_cents / 100.0,
        examples_count=examples_count,
    )


def _validate_non_negative_int(value: int, field_name: str) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.tip.training.{field_name}.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError(f"error.tip.training.{field_name}.not_int")
    if value < 0:
        raise ValueError(f"error.tip.training.{field_name}.negative")


def _validate_non_negative_finite(value: float, field_name: str) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.tip.training.{field_name}.bool_unsupported")

    value_as_float = float(value)

    if not math.isfinite(value_as_float):
        raise ValueError(f"error.tip.training.{field_name}.not_finite")
    if value_as_float < 0.0:
        raise ValueError(f"error.tip.training.{field_name}.negative")
