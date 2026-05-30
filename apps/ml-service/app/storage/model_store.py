from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

from app.models.tip_model import MODEL_NAME, TipModelMetadata, TipModelWrapper

StoredModelT = TypeVar("StoredModelT")


class PersistableModel(Protocol):
    model: Any
    version: int
    trained_count: int

    @property
    def metadata(self) -> TipModelMetadata:
        ...


@dataclass(frozen=True, slots=True, kw_only=True)
class ModelArtifactConfig:
    model_name: str
    artifact_prefix: str
    latest_filename: str
    idempotency_filename: str
    wrapper_factory: Callable[[Any, int, int], PersistableModel]

    def __post_init__(self) -> None:
        for field_name, value in (
            ("model_name", self.model_name),
            ("artifact_prefix", self.artifact_prefix),
            ("latest_filename", self.latest_filename),
            ("idempotency_filename", self.idempotency_filename),
        ):
            if not isinstance(value, str) or value.strip() == "":
                raise ValueError(f"error.storage.artifact_config.{field_name}.empty")


def tip_model_wrapper_factory(
    model: Any,
    version: int,
    trained_count: int,
) -> TipModelWrapper:
    return TipModelWrapper(
        model=model,
        version=version,
        trained_count=trained_count,
    )


def tip_model_artifact_config() -> ModelArtifactConfig:
    return ModelArtifactConfig(
        model_name=MODEL_NAME,
        artifact_prefix="tip-model-v",
        latest_filename="latest.json",
        idempotency_filename="idempotency.json",
        wrapper_factory=tip_model_wrapper_factory,
    )
