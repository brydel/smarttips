from __future__ import annotations

from app.models.distribution_features import to_distribution_river_dict
from app.models.distribution_model import MIN_WEIGHT, DistributionModelWrapper


class ConstantModel:
    def __init__(self, prediction: float | None) -> None:
        self.prediction = prediction

    def predict_one(self, x: dict[str, int | float | str]) -> float | None:
        return self.prediction

    def learn_one(self, x: dict[str, int | float | str], y: float) -> ConstantModel:
        return self


def valid_features() -> dict[str, int | float | str]:
    return to_distribution_river_dict(
        {
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
    )


def test_predict_weight_is_deterministic_for_same_input() -> None:
    model = DistributionModelWrapper()
    features = valid_features()

    assert model.predict_weight(features) == model.predict_weight(features)


def test_predict_weight_clamps_negative_linear_output_to_positive_weight() -> None:
    model = DistributionModelWrapper(model=ConstantModel(-0.25))

    assert model.predict_weight(valid_features()) == MIN_WEIGHT


def test_learn_share_updates_version_and_trained_count() -> None:
    model = DistributionModelWrapper()

    model.learn_share(valid_features(), 0.6)

    assert model.version == 1
    assert model.trained_count == 1
