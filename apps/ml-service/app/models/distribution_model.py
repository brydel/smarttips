from __future__ import annotations

import math
import numbers
from dataclasses import dataclass
from typing import Any, Final, Protocol, Self, TypeAlias, cast

from river import compose, linear_model, preprocessing

from app.models.features import RiverFeatureDict, RiverFeatureValue
from app.models.tip_model import TipModelMetadata
from app.storage.model_store import ModelArtifactConfig

MODEL_NAME: Final[str] = "tip_distribution_regressor"
ARTIFACT_PREFIX: Final[str] = "tip-distribution-model-v"
LATEST_FILENAME: Final[str] = "latest.distribution.json"
IDEMPOTENCY_FILENAME: Final[str] = "idempotency.distribution.json"
DEFAULT_WEIGHT: Final[float] = 1.0
MIN_WEIGHT: Final[float] = 1e-9
MAX_WEIGHT: Final[float] = 1.0
L2_REGULARIZATION: Final[float] = 0.01


class RiverRegressor(Protocol):
    def predict_one(self, x: dict[str, RiverFeatureValue]) -> float | None:
        ...

    def learn_one(self, x: dict[str, RiverFeatureValue], y: float) -> Self:
        ...


RiverPipeline: TypeAlias = RiverRegressor


@dataclass(frozen=True, slots=True, kw_only=True)
class EmployeeTipAllocation:
    employee_id: str
    tips_cents: int
    weight: float
    share: float

    def __post_init__(self) -> None:
        if not isinstance(self.employee_id, str) or self.employee_id.strip() == "":
            raise ValueError("error.distribution.allocation.employee_id.empty")
        if isinstance(self.tips_cents, bool):
            raise TypeError("error.distribution.allocation.tips.bool_unsupported")
        if not isinstance(self.tips_cents, int):
            raise TypeError("error.distribution.allocation.tips.not_int")
        if self.tips_cents < 0:
            raise ValueError("error.distribution.allocation.tips.negative")
        _validate_finite_float(self.weight, "weight")
        _validate_finite_float(self.share, "share")
        if self.weight < 0.0:
            raise ValueError("error.distribution.allocation.weight.negative")
        if self.share < 0.0 or self.share > 1.0:
            raise ValueError("error.distribution.allocation.share.out_of_range")


def create_distribution_model() -> RiverPipeline:
    numeric_features = compose.SelectType(numbers.Number) | preprocessing.StandardScaler()
    categorical_features = compose.SelectType(str) | preprocessing.OneHotEncoder()

    model = (numeric_features + categorical_features) | linear_model.LinearRegression(
        l2=L2_REGULARIZATION,
    )

    return cast(RiverPipeline, model)


class DistributionModelWrapper:
    def __init__(
        self,
        *,
        model: RiverPipeline | None = None,
        version: int = 0,
        trained_count: int = 0,
    ) -> None:
        if isinstance(version, bool):
            raise TypeError("error.distribution.model.version.bool_unsupported")
        if version < 0:
            raise ValueError("error.distribution.model.version.negative")
        if isinstance(trained_count, bool):
            raise TypeError("error.distribution.model.trained_count.bool_unsupported")
        if trained_count < 0:
            raise ValueError("error.distribution.model.trained_count.negative")

        self.model = model if model is not None else create_distribution_model()
        self.version = version
        self.trained_count = trained_count

    @property
    def metadata(self) -> TipModelMetadata:
        return TipModelMetadata(
            model_name=MODEL_NAME,
            model_version=self.version,
            trained_count=self.trained_count,
        )

    def predict_weight(self, features: RiverFeatureDict) -> float:
        safe_features = self._validate_features(features)
        prediction = self.model.predict_one(safe_features)

        if prediction is None:
            return DEFAULT_WEIGHT

        prediction_as_float = float(prediction)

        if not math.isfinite(prediction_as_float):
            return DEFAULT_WEIGHT

        # DECISION: train on observed shares and clamp the linear regressor output
        # into a positive Hamilton weight instead of using logit smoothing in V1.
        return max(MIN_WEIGHT, min(prediction_as_float, MAX_WEIGHT))

    def learn_share(self, features: RiverFeatureDict, target_share: float) -> None:
        safe_features = self._validate_features(features)
        safe_target = self._validate_target_share(target_share)

        self.model.learn_one(safe_features, safe_target)
        self.trained_count += 1
        self.version += 1

    def _validate_features(self, features: RiverFeatureDict) -> RiverFeatureDict:
        if not features:
            raise ValueError("error.distribution.model.features.empty")

        safe_features: RiverFeatureDict = {}

        for feature_name, value in features.items():
            if not isinstance(feature_name, str) or feature_name.strip() == "":
                raise ValueError("error.distribution.model.features.name_empty")

            safe_features[feature_name] = self._validate_feature_value(value)

        return safe_features

    def _validate_feature_value(self, value: RiverFeatureValue) -> RiverFeatureValue:
        if isinstance(value, bool):
            raise TypeError("error.distribution.model.features.bool_unsupported")

        if isinstance(value, int):
            return value

        if isinstance(value, float):
            if not math.isfinite(value):
                raise ValueError("error.distribution.model.features.float_not_finite")

            return value

        if isinstance(value, str):
            normalized = value.strip()

            if normalized == "":
                raise ValueError("error.distribution.model.features.string_empty")

            if len(normalized) > 128:
                raise ValueError("error.distribution.model.features.string_too_long")

            return normalized

        raise TypeError("error.distribution.model.features.unsupported_type")

    def _validate_target_share(self, target_share: float) -> float:
        if isinstance(target_share, bool):
            raise TypeError("error.distribution.model.target_share.bool_unsupported")

        target_as_float = float(target_share)

        if not math.isfinite(target_as_float):
            raise ValueError("error.distribution.model.target_share.not_finite")

        if target_as_float < 0.0 or target_as_float > 1.0:
            raise ValueError("error.distribution.model.target_share.out_of_range")

        return target_as_float


def distribution_model_wrapper_factory(
    model: Any,
    version: int,
    trained_count: int,
) -> DistributionModelWrapper:
    return DistributionModelWrapper(
        model=cast(RiverPipeline, model),
        version=version,
        trained_count=trained_count,
    )


def distribution_model_artifact_config() -> ModelArtifactConfig:
    return ModelArtifactConfig(
        model_name=MODEL_NAME,
        artifact_prefix=ARTIFACT_PREFIX,
        latest_filename=LATEST_FILENAME,
        idempotency_filename=IDEMPOTENCY_FILENAME,
        wrapper_factory=distribution_model_wrapper_factory,
    )


def _validate_finite_float(value: float, field_name: str) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.distribution.allocation.{field_name}.bool_unsupported")

    value_as_float = float(value)

    if not math.isfinite(value_as_float):
        raise ValueError(f"error.distribution.allocation.{field_name}.not_finite")
