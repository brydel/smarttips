import asyncio
from collections import OrderedDict
from typing import Literal
from uuid import UUID

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.features import (
    to_river_predict_dict,
    to_river_train_dict,
)
from app.models.tip_model import TipModelWrapper
from app.storage.base import (
    ConcurrentWriteError,
    IdempotencyStore,
    ModelStore,
    TenantId,
)

logger = get_logger(__name__)

TrainStatus = Literal["trained", "already_trained"]


class ModelService:
    def __init__(
        self,
        *,
        model_store: ModelStore,
        idempotency_store: IdempotencyStore,
    ) -> None:
        self._model_store = model_store
        self._idempotency_store = idempotency_store
        self._settings = get_settings()

        self._cache: OrderedDict[UUID, TipModelWrapper] = OrderedDict()
        self._cache_lock = asyncio.Lock()

        self._tenant_locks: dict[UUID, asyncio.Lock] = {}
        self._tenant_locks_guard = asyncio.Lock()

    async def _get_tenant_lock(self, tenant_id: TenantId) -> asyncio.Lock:
        async with self._tenant_locks_guard:
            lock = self._tenant_locks.get(tenant_id)

            if lock is None:
                lock = asyncio.Lock()
                self._tenant_locks[tenant_id] = lock

            return lock

    async def _get_or_load_model(self, tenant_id: TenantId) -> TipModelWrapper:
        async with self._cache_lock:
            cached_model = self._cache.get(tenant_id)

            if cached_model is not None:
                self._cache.move_to_end(tenant_id)
                return cached_model

        loaded_model = await self._model_store.load(tenant_id)
        model = loaded_model if loaded_model is not None else TipModelWrapper()

        async with self._cache_lock:
            existing_model = self._cache.get(tenant_id)

            if existing_model is not None:
                self._cache.move_to_end(tenant_id)
                return existing_model

            self._cache[tenant_id] = model
            self._cache.move_to_end(tenant_id)
            self._evict_if_needed_unlocked()

            return model

    async def _replace_cached_model(
        self,
        tenant_id: TenantId,
        model: TipModelWrapper,
    ) -> None:
        async with self._cache_lock:
            self._cache[tenant_id] = model
            self._cache.move_to_end(tenant_id)
            self._evict_if_needed_unlocked()

    async def _evict_cached_model(self, tenant_id: TenantId) -> None:
        async with self._cache_lock:
            self._cache.pop(tenant_id, None)

    def _evict_if_needed_unlocked(self) -> None:
        max_tenants = self._settings.model_cache_max_tenants

        while len(self._cache) > max_tenants:
            evicted_tenant_id, _ = self._cache.popitem(last=False)

            logger.info(
                "model_cache_eviction",
                extra={
                    "evicted_tenant_id": str(evicted_tenant_id),
                    "cache_size": len(self._cache),
                    "max_tenants": max_tenants,
                },
            )

    async def predict(
        self,
        tenant_id: TenantId,
        features: dict[str, object],
    ) -> tuple[float, int]:
        river_features = to_river_predict_dict(features)

        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            model = await self._get_or_load_model(tenant_id)
            prediction = model.predict(river_features)

            logger.info(
                "model_predict",
                extra={
                    "tenant_id": str(tenant_id),
                    "model_version": model.version,
                    "is_cold_start": model.version == 0,
                },
            )

            return prediction, model.version

    async def train(
        self,
        tenant_id: TenantId,
        features: dict[str, object],
        target: float,
        idempotency_key: str,
    ) -> tuple[TrainStatus, int]:
        river_features = to_river_train_dict(features)

        existing = await self._idempotency_store.get_processed(
            tenant_id,
            idempotency_key,
        )

        if existing is not None:
            return "already_trained", existing.metadata.model_version

        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            existing_after_lock = await self._idempotency_store.get_processed(
                tenant_id,
                idempotency_key,
            )

            if existing_after_lock is not None:
                return "already_trained", existing_after_lock.metadata.model_version

            model = await self._get_or_load_model(tenant_id)
            model.learn(river_features, target)

            try:
                persisted_meta = await self._model_store.save(tenant_id, model)
            except ConcurrentWriteError:
                await self._evict_cached_model(tenant_id)

                logger.warning(
                    "model_persist_concurrent_write",
                    extra={
                        "tenant_id": str(tenant_id),
                        "idempotency_key": idempotency_key,
                    },
                )

                raise
            except Exception:
                await self._evict_cached_model(tenant_id)

                logger.exception(
                    "model_persist_failed",
                    extra={
                        "tenant_id": str(tenant_id),
                        "idempotency_key": idempotency_key,
                    },
                )

                raise

            processed_record = await self._idempotency_store.record_processed_once(
                tenant_id,
                idempotency_key,
                persisted_meta,
            )

            # Defensive guard: covers a future race where a peer instance commits the same
            # idempotency_key with a different version, for example after a model
            # rehydration retry. In the current single-version-per-train flow, this branch
            # is expected to be unreachable, but it fails safe instead of leaving a ghost
            # model in cache.
            if processed_record.metadata.model_version != persisted_meta.model_version:
                await self._evict_cached_model(tenant_id)

                return "already_trained", processed_record.metadata.model_version

            logger.info(
                "model_train",
                extra={
                    "tenant_id": str(tenant_id),
                    "model_version": persisted_meta.model_version,
                    "trained_count": persisted_meta.trained_count,
                },
            )

            return "trained", persisted_meta.model_version