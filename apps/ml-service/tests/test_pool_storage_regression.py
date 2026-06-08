from __future__ import annotations

import asyncio
import json
from collections.abc import Callable, Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from app.core.config import get_settings
from app.core.security import verify_artifact
from app.models.tip_model import MODEL_NAME, TipModelWrapper
from app.storage.local_store import LocalModelStore


@pytest.fixture(autouse=True)
def settings_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    async def run_synchronously(
        func: Callable[..., object],
        /,
        *args: object,
        **kwargs: object,
    ) -> object:
        return func(*args, **kwargs)

    monkeypatch.setattr(asyncio, "to_thread", run_synchronously)
    monkeypatch.setenv("INTERNAL_TOKEN", "x" * 32)
    monkeypatch.setenv("MODEL_ARTIFACT_SECRET", "y" * 32)
    monkeypatch.setenv("LOCAL_MODEL_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class TipMemoryRegressor:
    def __init__(self) -> None:
        self.prediction = 0.0

    def predict_one(self, x: dict[str, int | float | str]) -> float:
        return self.prediction

    def learn_one(self, x: dict[str, int | float | str], y: float) -> TipMemoryRegressor:
        self.prediction = y
        return self


def tip_features(sales_total_cents: int, assigned_sales_cents: int) -> dict[str, int | float | str]:
    return {
        "role": "SERVER",
        "shift_type": "DINNER",
        "day_of_week": 4,
        "hour_start": 17,
        "hour_end": 23,
        "employee_count": 6,
        "expected_sales_cents": 390_000,
        "sales_total_cents": sales_total_cents,
        "assigned_sales_cents": assigned_sales_cents,
        "orders_count": 90,
    }


@pytest.mark.asyncio
async def test_tip_local_store_round_trip_preserves_prediction_and_legacy_artifact_shape(
    tmp_path: Path,
) -> None:
    tenant_id = uuid4()
    model = TipModelWrapper(model=TipMemoryRegressor())

    for sales_total_cents, assigned_sales_cents, target_cents in (
        (390_000, 120_000, 5_900),
        (425_000, 140_000, 6_500),
        (510_000, 180_000, 7_900),
    ):
        model.learn(tip_features(sales_total_cents, assigned_sales_cents), target_cents)

    prediction_features = tip_features(460_000, 150_000)
    prediction_before = model.predict(prediction_features)
    store = LocalModelStore[TipModelWrapper]()

    metadata = await store.save(tenant_id, model)
    loaded_model = await store.load(tenant_id)

    assert loaded_model is not None
    assert loaded_model.version == model.version
    assert loaded_model.trained_count == model.trained_count
    assert loaded_model.predict(prediction_features) == prediction_before

    tenant_dir = tmp_path / str(tenant_id)
    legacy_artifact_path = tenant_dir / f"tip-model-v{model.version}.pkl"
    legacy_manifest_path = tenant_dir / "latest.json"
    legacy_idempotency_path = tenant_dir / "idempotency.json"

    assert metadata.model_name == MODEL_NAME
    assert legacy_artifact_path.exists()
    assert legacy_manifest_path.exists()
    assert not legacy_idempotency_path.exists()

    manifest = json.loads(legacy_manifest_path.read_text(encoding="utf-8"))

    assert manifest["model_name"] == MODEL_NAME
    assert manifest["artifact_filename"] == legacy_artifact_path.name

    artifact_bytes = legacy_artifact_path.read_bytes()

    assert verify_artifact(
        artifact_bytes,
        manifest["signature"],
        tenant_id=str(tenant_id),
        model_name=MODEL_NAME,
        model_version=model.version,
    )
