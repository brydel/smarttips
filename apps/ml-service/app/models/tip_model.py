import math
import numbers
from dataclasses import dataclass
from typing import Protocol, Self, TypeAlias, cast

from river import compose, linear_model, preprocessing

from app.models.features import RiverFeatureDict, RiverFeatureValue

MODEL_NAME = "tip_regressor"
MAX_REASONABLE_TIPS_PREDICTION = 1_000_000.0


class RiverRegressor(Protocol):
    def predict_one(self, x: dict[str, RiverFeatureValue]) -> float | None:
        ...

    def learn_one(self, x: dict[str, RiverFeatureValue], y: float) -> Self:
        ...


RiverPipeline: TypeAlias = RiverRegressor


@dataclass(slots=True, frozen=True)
class TipModelMetadata:
    model_name: str
    model_version: int
    trained_count: int


def create_tip_model() -> RiverPipeline:
    numeric_features = compose.SelectType(numbers.Number) | preprocessing.StandardScaler()
    categorical_features = compose.SelectType(str) | preprocessing.OneHotEncoder()

    model = (numeric_features + categorical_features) | linear_model.LinearRegression()

    return cast(RiverPipeline, model)


class TipModelWrapper:
    def __init__(
        self,
        *,
        model: RiverPipeline | None = None,
        version: int = 0,
        trained_count: int = 0,
    ) -> None:
        if version < 0:
            raise ValueError("model version must be greater than or equal to 0")

        if trained_count < 0:
            raise ValueError("trained_count must be greater than or equal to 0")

        self.model = model if model is not None else create_tip_model()
        self.version = version
        self.trained_count = trained_count

    @property
    def metadata(self) -> TipModelMetadata:
        return TipModelMetadata(
            model_name=MODEL_NAME,
            model_version=self.version,
            trained_count=self.trained_count,
        )

    def predict(self, features: RiverFeatureDict) -> float:
        safe_features = self._validate_features(features)

        prediction = self.model.predict_one(safe_features)

        if prediction is None:
            return 0.0

        prediction_as_float = float(prediction)

        if not math.isfinite(prediction_as_float):
            return 0.0

        return max(0.0, min(prediction_as_float, MAX_REASONABLE_TIPS_PREDICTION))

    def learn(self, features: RiverFeatureDict, target: float) -> None:
        safe_features = self._validate_features(features)
        safe_target = self._validate_target(target)

        self.model.learn_one(safe_features, safe_target)

        self.trained_count += 1
        self.version += 1

    def _validate_features(self, features: RiverFeatureDict) -> RiverFeatureDict:
        if not features:
            raise ValueError("features must not be empty")

        safe_features: RiverFeatureDict = {}

        for feature_name, value in features.items():
            if not isinstance(feature_name, str) or feature_name.strip() == "":
                raise ValueError("feature names must be non-empty strings")

            safe_features[feature_name] = self._validate_feature_value(value)

        return safe_features

    def _validate_feature_value(self, value: RiverFeatureValue) -> RiverFeatureValue:
        if isinstance(value, bool):
            raise TypeError("boolean feature values are not supported")

        if isinstance(value, int):
            return value

        if isinstance(value, float):
            if not math.isfinite(value):
                raise ValueError("float feature values must be finite")

            return value

        if isinstance(value, str):
            normalized = value.strip()

            if normalized == "":
                raise ValueError("string feature values must not be empty")

            if len(normalized) > 128:
                raise ValueError("string feature values must not exceed 128 characters")

            return normalized

        raise TypeError(f"unsupported feature value type: {type(value).__name__}")

    def _validate_target(self, target: float) -> float:
        if isinstance(target, bool):
            raise TypeError("target must not be a boolean")

        target_as_float = float(target)

        if not math.isfinite(target_as_float):
            raise ValueError("target must be finite")

        if target_as_float < 0.0:
            raise ValueError("target must be greater than or equal to 0")

        if target_as_float > MAX_REASONABLE_TIPS_PREDICTION:
            raise ValueError(
                f"target must be lower than or equal to {MAX_REASONABLE_TIPS_PREDICTION}"
            )

        return target_as_float