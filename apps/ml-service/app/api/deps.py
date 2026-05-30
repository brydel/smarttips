from __future__ import annotations

from functools import lru_cache
from typing import cast

from app.core.config import get_settings
from app.models.distribution_model import (
    DistributionModelWrapper,
    distribution_model_artifact_config,
)
from app.models.tip_model import TipModelWrapper
from app.services.model_service import ModelService
from app.storage.base import AppStorage, IdempotencyStore, ModelStore
from app.storage.local_store import LocalModelStore
from app.storage.r2_store import R2ModelStore


@lru_cache(maxsize=1)
def get_storage_backend() -> AppStorage:
    settings = get_settings()

    if settings.storage_backend == "r2":
        return R2ModelStore()

    return LocalModelStore()


def get_model_store() -> ModelStore[TipModelWrapper]:
    return get_storage_backend()


def get_idempotency_store() -> IdempotencyStore:
    return get_storage_backend()


@lru_cache(maxsize=1)
def get_distribution_storage_backend() -> ModelStore[DistributionModelWrapper]:
    settings = get_settings()
    config = distribution_model_artifact_config()

    if settings.storage_backend == "r2":
        return R2ModelStore[DistributionModelWrapper](artifact_config=config)

    return LocalModelStore[DistributionModelWrapper](artifact_config=config)


@lru_cache(maxsize=1)
def get_model_service() -> ModelService:
    storage_backend = get_storage_backend()

    return ModelService(
        model_store=storage_backend,
        idempotency_store=storage_backend,
        distribution_model_store=get_distribution_storage_backend(),
        distribution_idempotency_store=cast(
            IdempotencyStore,
            get_distribution_storage_backend(),
        ),
    )
