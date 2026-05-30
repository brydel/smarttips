from __future__ import annotations

from app.models.distribution_training import (
    DistributionTrainingRow,
    learn_distribution_shift,
    progressive_validate_distribution,
)

FEATURES: dict[str, int | float | str] = {
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


class SpyDistributionModel:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.weights = [2.0, 1.0]

    def predict_weight(self, features: dict[str, int | float | str]) -> float:
        self.calls.append("predict")
        return self.weights[len([call for call in self.calls if call == "predict"]) - 1]

    def learn_share(self, features: dict[str, int | float | str], target_share: float) -> None:
        assert self.calls[:2] == ["predict", "predict"]
        self.calls.append("learn")


def test_progressive_validation_predicts_before_learning_and_normalizes_share_mae() -> None:
    rows = (
        DistributionTrainingRow(
            shift_id="shift-1",
            employee_id="employee-1",
            features=FEATURES,
            tips_received_cents=60,
        ),
        DistributionTrainingRow(
            shift_id="shift-1",
            employee_id="employee-2",
            features={**FEATURES, "assigned_sales_cents": 40_00},
            tips_received_cents=40,
        ),
    )
    model = SpyDistributionModel()

    metrics = progressive_validate_distribution(rows, model)  # type: ignore[arg-type]

    assert model.calls == ["predict", "predict", "learn", "learn"]
    assert metrics.mae_cents == 7.0
    assert round(metrics.mae_share, 6) == 0.066667


def test_learn_distribution_shift_skips_zero_pool_without_learning() -> None:
    rows = (
        DistributionTrainingRow(
            shift_id="shift-1",
            employee_id="employee-1",
            features=FEATURES,
            tips_received_cents=0,
        ),
    )
    model = SpyDistributionModel()

    assert learn_distribution_shift(model, rows) == 0  # type: ignore[arg-type]
    assert model.calls == []


def test_progressive_validation_skips_zero_pool_shift() -> None:
    rows = (
        DistributionTrainingRow(
            shift_id="shift-1",
            employee_id="employee-1",
            features=FEATURES,
            tips_received_cents=0,
        ),
    )

    metrics = progressive_validate_distribution(rows, SpyDistributionModel())  # type: ignore[arg-type]

    assert metrics.examples_count == 0
    assert metrics.skipped_zero_pool_shifts == 1
