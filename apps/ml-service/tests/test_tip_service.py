from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from app.core.config import get_settings
from app.models.tip_model import TipModelMetadata, TipModelWrapper
from app.services.model_service import ModelService
from app.storage.base import IdempotencyRecord, TenantId


class MemoryTipStore:
    def __init__(self, model: TipModelWrapper | None = None) -> None:
        self.model = model
        self.saved_count = 0
        self.load_count = 0
        self.records: dict[tuple[UUID, str], IdempotencyRecord] = {}

    async def load(self, tenant_id: TenantId) -> TipModelWrapper | None:
        self.load_count += 1
        return self.model

    async def save(self, tenant_id: TenantId, model: TipModelWrapper) -> TipModelMetadata:
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

    async def delete_tenant_records(self, tenant_id: TenantId) -> int:
        records_to_delete = [
            record_key for record_key in self.records if record_key[0] == tenant_id
        ]
        for record_key in records_to_delete:
            del self.records[record_key]
        return len(records_to_delete)


@pytest.fixture(autouse=True)
def settings_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    monkeypatch.setenv("INTERNAL_TOKEN", "x" * 32)
    monkeypatch.setenv("MODEL_ARTIFACT_SECRET", "y" * 32)
    monkeypatch.setenv("LOCAL_MODEL_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def features() -> dict[str, object]:
    return {
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


@pytest.mark.asyncio
async def test_train_and_predict_use_same_post_shift_feature_space() -> None:
    tenant_id = uuid4()
    store = MemoryTipStore()
    service = ModelService(model_store=store, idempotency_store=store)

    status, model_version = await service.train(
        tenant_id=tenant_id,
        features=features(),
        target_cents=12_345,
        idempotency_key="tenant:shift:employee:tips:v1",
    )
    prediction_cents, prediction_version = await service.predict(
        tenant_id=tenant_id,
        features=features(),
    )

    assert status == "trained"
    assert model_version == 1
    assert prediction_version == 1
    assert prediction_cents >= 0
    assert store.saved_count == 1


@pytest.mark.asyncio
async def test_train_is_idempotent_for_duplicate_key() -> None:
    tenant_id = uuid4()
    store = MemoryTipStore()
    service = ModelService(model_store=store, idempotency_store=store)

    first_status, first_version = await service.train(
        tenant_id=tenant_id,
        features=features(),
        target_cents=12_345,
        idempotency_key="tenant:shift:employee:tips:v1",
    )
    second_status, second_version = await service.train(
        tenant_id=tenant_id,
        features=features(),
        target_cents=54_321,
        idempotency_key="tenant:shift:employee:tips:v1",
    )

    assert first_status == "trained"
    assert second_status == "already_trained"
    assert first_version == second_version == 1
    assert store.saved_count == 1
    assert store.model is not None
    assert store.model.trained_count == 1


@pytest.mark.asyncio
async def test_service_rejects_forbidden_features_before_loading_model() -> None:
    tenant_id = uuid4()
    store = MemoryTipStore()
    service = ModelService(model_store=store, idempotency_store=store)
    payload = features()
    payload["tenant_id"] = str(tenant_id)

    with pytest.raises(ValueError, match=re.escape("error.tip.features.forbidden")):
        await service.predict(tenant_id=tenant_id, features=payload)

    assert store.load_count == 0
