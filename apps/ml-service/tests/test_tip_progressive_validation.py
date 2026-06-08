from __future__ import annotations

from app.models.tip_training import TipTrainingRow, progressive_validate_tips

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


class SpyTipModel:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.predictions = [90, 130]

    def predict(self, features: dict[str, int | float | str]) -> int:
        self.calls.append("predict")
        return self.predictions[len([call for call in self.calls if call == "predict"]) - 1]

    def learn(self, features: dict[str, int | float | str], target_cents: int) -> None:
        assert self.calls.count("predict") > self.calls.count("learn")
        self.calls.append("learn")


def test_progressive_validation_predicts_before_learning_and_reports_cents_metrics() -> None:
    rows = (
        TipTrainingRow(features=FEATURES, tips_received_cents=100),
        TipTrainingRow(
            features={**FEATURES, "assigned_sales_cents": 40_00},
            tips_received_cents=100,
        ),
    )
    model = SpyTipModel()

    metrics = progressive_validate_tips(rows, model)  # type: ignore[arg-type]

    assert model.calls == ["predict", "learn", "predict", "learn"]
    assert metrics.examples_count == 2
    assert metrics.mae_cents == 20.0
    assert metrics.mae_dollars == 0.2
    assert round(metrics.rmse_cents, 6) == 22.36068
    assert round(metrics.rmse_dollars, 6) == 0.223607


def test_progressive_validation_empty_rows_returns_zero_metrics() -> None:
    metrics = progressive_validate_tips((), SpyTipModel())  # type: ignore[arg-type]

    assert metrics.examples_count == 0
    assert metrics.mae_cents == 0.0
    assert metrics.rmse_cents == 0.0
