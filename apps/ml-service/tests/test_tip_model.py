from __future__ import annotations

import math

import pytest
from app.models.tip_model import MAX_REASONABLE_TIPS_PREDICTION_CENTS, TipModelWrapper

FEATURES: dict[str, int | float | str] = {
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


class ConstantLogModel:
    def __init__(self, prediction: float | None) -> None:
        self.prediction = prediction
        self.learned_targets: list[float] = []

    def predict_one(self, x: dict[str, int | float | str]) -> float | None:
        return self.prediction

    def learn_one(self, x: dict[str, int | float | str], y: float) -> ConstantLogModel:
        self.learned_targets.append(y)
        return self


def test_predict_applies_expm1_and_returns_cents() -> None:
    model = TipModelWrapper(model=ConstantLogModel(math.log1p(12_345)))

    assert model.predict(FEATURES) == 12_345


def test_predict_clamps_negative_inverse_prediction_to_zero() -> None:
    model = TipModelWrapper(model=ConstantLogModel(-5.0))

    assert model.predict(FEATURES) == 0


def test_predict_clamps_overflow_to_maximum_cents() -> None:
    model = TipModelWrapper(model=ConstantLogModel(1_000.0))

    assert model.predict(FEATURES) == MAX_REASONABLE_TIPS_PREDICTION_CENTS


def test_learn_applies_log1p_target_transform() -> None:
    raw_model = ConstantLogModel(None)
    model = TipModelWrapper(model=raw_model)

    model.learn(FEATURES, 12_345)

    assert raw_model.learned_targets == [math.log1p(12_345)]
    assert model.version == 1
    assert model.trained_count == 1


@pytest.mark.parametrize("bad_target", [True, 12.5, -1])
def test_learn_rejects_invalid_targets(bad_target: object) -> None:
    model = TipModelWrapper()

    with pytest.raises((TypeError, ValueError)):
        model.learn(FEATURES, bad_target)  # type: ignore[arg-type]
