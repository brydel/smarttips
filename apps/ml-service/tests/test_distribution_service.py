from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from app.core.config import get_settings
from app.models.distribution_model import DistributionModelWrapper
from app.models.tip_model import TipModelMetadata, TipModelWrapper
from app.services.model_service import ModelService
from app.storage.base import IdempotencyRecord, TenantId


class MemoryDistributionStore:
    def __init__(self, model: DistributionModelWrapper | None = None) -> None:
        self.model = model
        self.saved_count = 0
        self.load_count = 0
        self.records: dict[tuple[UUID, str], IdempotencyRecord] = {}

    async def load(self, tenant_id: TenantId) -> DistributionModelWrapper | None:
        self.load_count += 1
        return self.model

    async def save(
        self,
        tenant_id: TenantId,
        model: DistributionModelWrapper,
    ) -> TipModelMetadata:
        self.saved_count += 1
        self.model = model
        return model.metadata

    async def load_metadata(self, tenant_id: TenantId) -> TipModelMetadata | None:
        if self.model is None:
            return None

        return self.model.metadata

    async def exists(self, tenant_id: TenantId) -> bool:
        return self.model is not None

    async def delete(self, tenant_id: TenantId) -> None:
        self.model = None

    async def list_versions(self, tenant_id: TenantId) -> list[int]:
        if self.model is None:
            return []

        return [self.model.version]

    async def prune_old_versions(self, tenant_id: TenantId, keep_last_n: int) -> int:
        return 0

    async def delete_tenant_records(self, tenant_id: TenantId) -> int:
        records_to_delete = [
            record_key
            for record_key in self.records
            if record_key[0] == tenant_id
        ]

        for record_key in records_to_delete:
            del self.records[record_key]

        return len(records_to_delete)

    async def get_processed(
        self,
        tenant_id: TenantId,
        key: str,
    ) -> IdempotencyRecord | None:
        return self.records.get((tenant_id, key))

    async def record_processed_once(
        self,
        tenant_id: TenantId,
        key: str,
        metadata: TipModelMetadata,
    ) -> IdempotencyRecord:
        record = self.records.get((tenant_id, key))

        if record is not None:
            return record

        record = IdempotencyRecord(key=key, metadata=metadata)
        self.records[(tenant_id, key)] = record
        return record


class UnusedPoolStore:
    def __init__(self) -> None:
        self.records: dict[tuple[UUID, str], IdempotencyRecord] = {}

    async def load(self, tenant_id: TenantId) -> TipModelWrapper | None:
        return None

    async def save(self, tenant_id: TenantId, model: TipModelWrapper) -> TipModelMetadata:
        return model.metadata

    async def load_metadata(self, tenant_id: TenantId) -> TipModelMetadata | None:
        return None

    async def exists(self, tenant_id: TenantId) -> bool:
        return False

    async def delete(self, tenant_id: TenantId) -> None:
        return None

    async def list_versions(self, tenant_id: TenantId) -> list[int]:
        return []

    async def prune_old_versions(self, tenant_id: TenantId, keep_last_n: int) -> int:
        return 0

    async def get_processed(
        self,
        tenant_id: TenantId,
        key: str,
    ) -> IdempotencyRecord | None:
        return self.records.get((tenant_id, key))

    async def record_processed_once(
        self,
        tenant_id: TenantId,
        key: str,
        metadata: TipModelMetadata,
    ) -> IdempotencyRecord:
        record = IdempotencyRecord(key=key, metadata=metadata)
        self.records[(tenant_id, key)] = record
        return record

    async def delete_tenant_records(self, tenant_id: TenantId) -> int:
        return 0


class RaisingDistributionStore(MemoryDistributionStore):
    async def load(self, tenant_id: TenantId) -> DistributionModelWrapper | None:
        raise AssertionError("model must not be called for a zero pool")


@pytest.fixture(autouse=True)
def settings_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    monkeypatch.setenv("INTERNAL_TOKEN", "x" * 32)
    monkeypatch.setenv("MODEL_ARTIFACT_SECRET", "y" * 32)
    monkeypatch.setenv("LOCAL_MODEL_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def employee_payload(employee_id: UUID, tips: int = 0) -> dict[str, object]:
    return {
        "employee_id": employee_id,
        "role": "SERVER",
        "shift_type": "DINNER",
        "day_of_week": 4,
        "hour_start": 17,
        "hour_end": 23,
        "employee_count": 1,
        "sales_total_cents": 0,
        "assigned_sales_cents": 0,
        "orders_count": 0,
        "tips_received_cents": tips,
    }


@pytest.mark.asyncio
async def test_distribute_zero_pool_returns_zero_allocations_without_loading_model() -> None:
    distribution_store = RaisingDistributionStore()
    service = ModelService(
        model_store=UnusedPoolStore(),
        idempotency_store=UnusedPoolStore(),
        distribution_model_store=distribution_store,
        distribution_idempotency_store=distribution_store,
    )

    allocations, model_version = await service.distribute(
        tenant_id=uuid4(),
        pool_cents=0,
        employee_features=[employee_payload(uuid4())],
    )

    assert model_version == 0
    assert tuple(allocation.tips_cents for allocation in allocations) == (0,)


@pytest.mark.asyncio
async def test_train_distribution_zero_pool_skips_learning_and_persistence() -> None:
    distribution_store = MemoryDistributionStore(DistributionModelWrapper())
    service = ModelService(
        model_store=UnusedPoolStore(),
        idempotency_store=UnusedPoolStore(),
        distribution_model_store=distribution_store,
        distribution_idempotency_store=distribution_store,
    )

    status, model_version, skipped_zero_pool = await service.train_distribution(
        tenant_id=uuid4(),
        shift_id=uuid4(),
        employee_examples=[employee_payload(uuid4())],
        idempotency_key="tenant:shift:distribution:v1",
    )

    assert status == "trained"
    assert model_version == 0
    assert skipped_zero_pool is True
    assert distribution_store.saved_count == 0
    assert distribution_store.model is not None
    assert distribution_store.model.trained_count == 0
