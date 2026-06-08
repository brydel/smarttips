import math
import numbers
from dataclasses import dataclass
from typing import Final, Protocol, Self, TypeAlias, cast

from river import compose, linear_model, preprocessing

from app.models.features import RiverFeatureDict, RiverFeatureValue

MODEL_NAME: Final[str] = "tip_regressor"
MAX_REASONABLE_TIPS_PREDICTION_CENTS: Final[int] = 1_000_000


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
        if isinstance(version, bool):
            raise TypeError("error.tip.model.version.bool_unsupported")
        if version < 0:
            raise ValueError("error.tip.model.version.negative")

        if isinstance(trained_count, bool):
            raise TypeError("error.tip.model.trained_count.bool_unsupported")
        if trained_count < 0:
            raise ValueError("error.tip.model.trained_count.negative")

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

    def predict(self, features: RiverFeatureDict) -> int:
        safe_features = self._validate_features(features)
        prediction = self.model.predict_one(safe_features)

        if prediction is None:
            return 0

        prediction_as_float = float(prediction)

        if not math.isfinite(prediction_as_float):
            return 0

        try:
            prediction_cents = math.expm1(prediction_as_float)
        except OverflowError:
            return MAX_REASONABLE_TIPS_PREDICTION_CENTS

        if not math.isfinite(prediction_cents):
            return 0

        rounded_prediction = round(prediction_cents)
        return max(0, min(rounded_prediction, MAX_REASONABLE_TIPS_PREDICTION_CENTS))

    def learn(self, features: RiverFeatureDict, target_cents: int) -> None:
        safe_features = self._validate_features(features)
        safe_target = self._validate_target_cents(target_cents)

        self.model.learn_one(safe_features, math.log1p(safe_target))

        self.trained_count += 1
        self.version += 1

    def _validate_features(self, features: RiverFeatureDict) -> RiverFeatureDict:
        if not features:
            raise ValueError("error.tip.model.features.empty")

        safe_features: RiverFeatureDict = {}

        for feature_name, value in features.items():
            if not isinstance(feature_name, str) or feature_name.strip() == "":
                raise ValueError("error.tip.model.features.name_empty")

            safe_features[feature_name] = self._validate_feature_value(value)

        return safe_features

    def _validate_feature_value(self, value: RiverFeatureValue) -> RiverFeatureValue:
        if isinstance(value, bool):
            raise TypeError("error.tip.model.features.bool_unsupported")

        if isinstance(value, int):
            return value

        if isinstance(value, float):
            if not math.isfinite(value):
                raise ValueError("error.tip.model.features.float_not_finite")

            return value

        if isinstance(value, str):
            normalized = value.strip()

            if normalized == "":
                raise ValueError("error.tip.model.features.string_empty")

            if len(normalized) > 128:
                raise ValueError("error.tip.model.features.string_too_long")

            return normalized

        raise TypeError("error.tip.model.features.unsupported_type")

    def _validate_target_cents(self, target_cents: int) -> int:
        if isinstance(target_cents, bool):
            raise TypeError("error.tip.model.target.bool_unsupported")

        if not isinstance(target_cents, int):
            raise TypeError("error.tip.model.target.not_int")

        if target_cents < 0:
            raise ValueError("error.tip.model.target.negative")

        if target_cents > MAX_REASONABLE_TIPS_PREDICTION_CENTS:
            raise ValueError("error.tip.model.target.too_large")

        return target_cents
