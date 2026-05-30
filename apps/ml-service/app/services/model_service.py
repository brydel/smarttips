from __future__ import annotations

import asyncio
from collections import OrderedDict
from collections.abc import Sequence
from typing import Literal
from uuid import UUID

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.distribution_allocation import allocate_cents
from app.models.distribution_features import to_distribution_river_dict
from app.models.distribution_model import (
    DistributionModelWrapper,
    EmployeeTipAllocation,
)
from app.models.distribution_training import DistributionTrainingRow, learn_distribution_shift
from app.models.features import (
    to_river_predict_dict,
    to_river_train_dict,
)
from app.models.tip_model import TipModelWrapper
from app.storage.base import (
    ConcurrentWriteError,
    IdempotencyStore,
    ModelStore,
    ModelStoreError,
    TenantId,
)

logger = get_logger(__name__)

TrainStatus = Literal["trained", "already_trained"]


class ModelService:
    def __init__(
        self,
        *,
        model_store: ModelStore[TipModelWrapper],
        idempotency_store: IdempotencyStore,
        distribution_model_store: ModelStore[DistributionModelWrapper] | None = None,
        distribution_idempotency_store: IdempotencyStore | None = None,
    ) -> None:
        self._model_store = model_store
        self._idempotency_store = idempotency_store
        self._distribution_model_store = distribution_model_store
        self._distribution_idempotency_store = distribution_idempotency_store
        self._settings = get_settings()

        self._cache: OrderedDict[UUID, TipModelWrapper] = OrderedDict()
        self._distribution_cache: OrderedDict[UUID, DistributionModelWrapper] = OrderedDict()
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

    async def _get_or_load_distribution_model(
        self,
        tenant_id: TenantId,
    ) -> DistributionModelWrapper:
        distribution_model_store = self._require_distribution_model_store()

        async with self._cache_lock:
            cached_model = self._distribution_cache.get(tenant_id)

            if cached_model is not None:
                self._distribution_cache.move_to_end(tenant_id)
                return cached_model

        loaded_model = await distribution_model_store.load(tenant_id)
        model = loaded_model if loaded_model is not None else DistributionModelWrapper()

        async with self._cache_lock:
            existing_model = self._distribution_cache.get(tenant_id)

            if existing_model is not None:
                self._distribution_cache.move_to_end(tenant_id)
                return existing_model

            self._distribution_cache[tenant_id] = model
            self._distribution_cache.move_to_end(tenant_id)
            self._evict_distribution_if_needed_unlocked()

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

    async def _evict_cached_distribution_model(self, tenant_id: TenantId) -> None:
        async with self._cache_lock:
            self._distribution_cache.pop(tenant_id, None)

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

    def _evict_distribution_if_needed_unlocked(self) -> None:
        max_tenants = self._settings.model_cache_max_tenants

        while len(self._distribution_cache) > max_tenants:
            evicted_tenant_id, _ = self._distribution_cache.popitem(last=False)

            logger.info(
                "distribution_model_cache_eviction",
                extra={
                    "evicted_tenant_id": str(evicted_tenant_id),
                    "cache_size": len(self._distribution_cache),
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

    async def distribute(
        self,
        tenant_id: TenantId,
        pool_cents: int,
        employee_features: Sequence[dict[str, object]],
    ) -> tuple[tuple[EmployeeTipAllocation, ...], int]:
        # ASSUMPTION: BIS-28 V2 receives the pool from an upstream orchestrator.
        # This method intentionally does not call the existing pool model.
        safe_pool_cents = self._validate_pool_cents(pool_cents)

        if len(employee_features) == 0:
            raise ValueError("error.distribution.predict.employees.empty")

        if safe_pool_cents == 0:
            return (
                tuple(
                    EmployeeTipAllocation(
                        employee_id=self._employee_id_from_payload(employee),
                        tips_cents=0,
                        weight=0.0,
                        share=0.0,
                    )
                    for employee in employee_features
                ),
                0,
            )

        employee_ids = tuple(
            self._employee_id_from_payload(employee)
            for employee in employee_features
        )
        river_features = tuple(
            to_distribution_river_dict(self._distribution_feature_payload(employee))
            for employee in employee_features
        )

        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            model = await self._get_or_load_distribution_model(tenant_id)
            weights = tuple(model.predict_weight(features) for features in river_features)
            allocations = allocate_cents(safe_pool_cents, weights)
            total_weight = sum(weights)

            result = tuple(
                EmployeeTipAllocation(
                    employee_id=employee_id,
                    tips_cents=allocation,
                    weight=weight,
                    share=weight / total_weight,
                )
                for employee_id, allocation, weight in zip(
                    employee_ids,
                    allocations,
                    weights,
                    strict=True,
                )
            )

            logger.info(
                "distribution_model_predict",
                extra={
                    "tenant_id": str(tenant_id),
                    "model_version": model.version,
                    "is_cold_start": model.version == 0,
                },
            )

            return result, model.version

    async def train_distribution(
        self,
        tenant_id: TenantId,
        shift_id: UUID,
        employee_examples: Sequence[dict[str, object]],
        idempotency_key: str,
    ) -> tuple[TrainStatus, int, bool]:
        distribution_model_store = self._require_distribution_model_store()
        distribution_idempotency_store = self._require_distribution_idempotency_store()
        rows = tuple(
            DistributionTrainingRow(
                shift_id=str(shift_id),
                employee_id=self._employee_id_from_payload(example),
                features=to_distribution_river_dict(
                    self._distribution_feature_payload(example)
                ),
                tips_received_cents=self._tips_received_cents_from_payload(example),
            )
            for example in employee_examples
        )

        existing = await distribution_idempotency_store.get_processed(
            tenant_id,
            idempotency_key,
        )

        if existing is not None:
            return "already_trained", existing.metadata.model_version, False

        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            existing_after_lock = await distribution_idempotency_store.get_processed(
                tenant_id,
                idempotency_key,
            )

            if existing_after_lock is not None:
                return "already_trained", existing_after_lock.metadata.model_version, False

            model = await self._get_or_load_distribution_model(tenant_id)
            learned_count = learn_distribution_shift(model, rows)

            if learned_count == 0:
                processed_record = await distribution_idempotency_store.record_processed_once(
                    tenant_id,
                    idempotency_key,
                    model.metadata,
                )
                return "trained", processed_record.metadata.model_version, True

            try:
                persisted_meta = await distribution_model_store.save(tenant_id, model)
            except ConcurrentWriteError:
                await self._evict_cached_distribution_model(tenant_id)
                logger.warning(
                    "distribution_model_persist_concurrent_write",
                    extra={
                        "tenant_id": str(tenant_id),
                        "idempotency_key": idempotency_key,
                    },
                )
                raise
            except Exception:
                await self._evict_cached_distribution_model(tenant_id)
                logger.exception(
                    "distribution_model_persist_failed",
                    extra={
                        "tenant_id": str(tenant_id),
                        "idempotency_key": idempotency_key,
                    },
                )
                raise

            processed_record = await distribution_idempotency_store.record_processed_once(
                tenant_id,
                idempotency_key,
                persisted_meta,
            )

            if processed_record.metadata.model_version != persisted_meta.model_version:
                await self._evict_cached_distribution_model(tenant_id)
                return "already_trained", processed_record.metadata.model_version, False

            logger.info(
                "distribution_model_train",
                extra={
                    "tenant_id": str(tenant_id),
                    "model_version": persisted_meta.model_version,
                    "trained_count": persisted_meta.trained_count,
                },
            )

            return "trained", persisted_meta.model_version, False

    def _require_distribution_model_store(self) -> ModelStore[DistributionModelWrapper]:
        if self._distribution_model_store is None:
            raise ModelStoreError("error.distribution.storage.model_store_unconfigured")

        return self._distribution_model_store

    def _require_distribution_idempotency_store(self) -> IdempotencyStore:
        if self._distribution_idempotency_store is None:
            raise ModelStoreError("error.distribution.storage.idempotency_unconfigured")

        return self._distribution_idempotency_store

    def _distribution_feature_payload(self, payload: dict[str, object]) -> dict[str, object]:
        return {
            key: value
            for key, value in payload.items()
            if key not in {"employee_id", "tips_received_cents", "shift_id"}
        }

    def _employee_id_from_payload(self, payload: dict[str, object]) -> str:
        employee_id = payload.get("employee_id")

        if not isinstance(employee_id, UUID):
            raise TypeError("error.distribution.employee_id.not_uuid")

        return str(employee_id)

    def _tips_received_cents_from_payload(self, payload: dict[str, object]) -> int:
        value = payload.get("tips_received_cents")

        if isinstance(value, bool):
            raise TypeError("error.distribution.training.tips.bool_unsupported")
        if not isinstance(value, int):
            raise TypeError("error.distribution.training.tips.not_int")
        if value < 0:
            raise ValueError("error.distribution.training.tips.negative")

        return value

    def _validate_pool_cents(self, pool_cents: int) -> int:
        if isinstance(pool_cents, bool):
            raise TypeError("error.distribution.pool.bool_unsupported")
        if not isinstance(pool_cents, int):
            raise TypeError("error.distribution.pool.not_int")
        if pool_cents < 0:
            raise ValueError("error.distribution.pool.negative")

        return pool_cents
