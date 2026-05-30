from __future__ import annotations

import asyncio
import hashlib
import hmac
import io
import json
import os
import re
from pathlib import Path
from typing import Any, Final, Generic, TypeVar, cast
from uuid import UUID

import joblib

from app.core.config import get_settings
from app.core.security import sign_artifact, verify_artifact
from app.models.tip_model import TipModelMetadata
from app.storage.base import (
    ArtifactIntegrityError,
    ArtifactNotFoundError,
    ConcurrentWriteError,
    IdempotencyRecord,
    ModelStoreError,
    TenantId,
)
from app.storage.model_store import (
    ModelArtifactConfig,
    PersistableModel,
    tip_model_artifact_config,
)

ARTIFACT_SUFFIX: Final[str] = ".pkl"
UTF8: Final[str] = "utf-8"
JSON_INDENT: Final[int] = 2

StoredModelT = TypeVar("StoredModelT", bound=PersistableModel)


class LocalModelStore(Generic[StoredModelT]):
    def __init__(
        self,
        *,
        artifact_config: ModelArtifactConfig | None = None,
    ) -> None:
        self._settings = get_settings()
        self._root = self._settings.local_model_dir
        self._root.mkdir(parents=True, exist_ok=True)
        config = artifact_config or tip_model_artifact_config()
        self._model_name = config.model_name
        self._artifact_prefix = config.artifact_prefix
        self._latest_filename = config.latest_filename
        self._idempotency_filename = config.idempotency_filename
        self._wrapper_factory = config.wrapper_factory
        self._artifact_filename_pattern = re.compile(
            rf"^{re.escape(self._artifact_prefix)}([1-9][0-9]*)"
            rf"{re.escape(ARTIFACT_SUFFIX)}$"
        )

        self._tenant_locks: dict[UUID, asyncio.Lock] = {}
        self._locks_guard = asyncio.Lock()

    async def _get_tenant_lock(self, tenant_id: TenantId) -> asyncio.Lock:
        async with self._locks_guard:
            lock = self._tenant_locks.get(tenant_id)

            if lock is None:
                lock = asyncio.Lock()
                self._tenant_locks[tenant_id] = lock

            return lock

    def _tenant_dir(self, tenant_id: TenantId) -> Path:
        return self._root / str(tenant_id)

    def _artifact_path(self, tenant_id: TenantId, version: int) -> Path:
        if version < 1:
            raise ValueError("artifact version must be greater than or equal to 1")

        return self._tenant_dir(tenant_id) / f"{self._artifact_prefix}{version}{ARTIFACT_SUFFIX}"

    def _latest_path(self, tenant_id: TenantId) -> Path:
        return self._tenant_dir(tenant_id) / self._latest_filename

    def _idempotency_path(self, tenant_id: TenantId) -> Path:
        return self._tenant_dir(tenant_id) / self._idempotency_filename

    async def load(self, tenant_id: TenantId) -> StoredModelT | None:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            manifest = await self._read_latest_manifest_unlocked(tenant_id)

            if manifest is None:
                return None

            metadata = self._metadata_from_manifest(manifest)

            artifact_filename = self._get_required_str(manifest, "artifact_filename")
            artifact_version = self._version_from_artifact_filename(artifact_filename)

            if artifact_version != metadata.model_version:
                raise ArtifactIntegrityError(
                    "artifact filename version does not match metadata"
                )

            artifact_path = self._tenant_dir(tenant_id) / artifact_filename

            if not artifact_path.exists():
                raise ArtifactNotFoundError(
                    f"artifact missing for v{metadata.model_version}"
                )

            data = await asyncio.to_thread(artifact_path.read_bytes)

            self._verify_artifact_bytes(
                data=data,
                manifest=manifest,
                tenant_id=tenant_id,
                metadata=metadata,
            )

            model_object = await asyncio.to_thread(joblib.load, io.BytesIO(data))

            return cast(
                StoredModelT,
                self._wrapper_factory(
                    model_object,
                    metadata.model_version,
                    metadata.trained_count,
                ),
            )

    async def load_metadata(self, tenant_id: TenantId) -> TipModelMetadata | None:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            manifest = await self._read_latest_manifest_unlocked(tenant_id)

            if manifest is None:
                return None

            return self._metadata_from_manifest(manifest)

    async def save(self, tenant_id: TenantId, model: StoredModelT) -> TipModelMetadata:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            tenant_dir = self._tenant_dir(tenant_id)
            await asyncio.to_thread(tenant_dir.mkdir, parents=True, exist_ok=True)

            current_manifest = await self._read_latest_manifest_unlocked(tenant_id)

            if current_manifest is not None:
                current_metadata = self._metadata_from_manifest(current_manifest)

                if model.version <= current_metadata.model_version:
                    raise ConcurrentWriteError(
                        f"in-memory v{model.version} <= "
                        f"persisted v{current_metadata.model_version}"
                    )

            artifact_path = self._artifact_path(tenant_id, model.version)
            artifact_tmp_path = artifact_path.with_name(f"{artifact_path.name}.tmp")

            await asyncio.to_thread(joblib.dump, model.model, artifact_tmp_path)
            data = await asyncio.to_thread(artifact_tmp_path.read_bytes)

            sha256 = hashlib.sha256(data).hexdigest()

            signature = sign_artifact(
                data,
                tenant_id=str(tenant_id),
                model_name=self._model_name,
                model_version=model.version,
            )

            latest = {
                "model_name": self._model_name,
                "model_version": model.version,
                "trained_count": model.trained_count,
                "sha256": sha256,
                "signature": signature,
                "artifact_filename": artifact_path.name,
            }

            latest_path = self._latest_path(tenant_id)
            latest_tmp_path = latest_path.with_name(f"{latest_path.name}.tmp")

            await asyncio.to_thread(os.replace, artifact_tmp_path, artifact_path)
            await self._write_json_atomic(latest_tmp_path, latest_path, latest)

            return model.metadata

    async def exists(self, tenant_id: TenantId) -> bool:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            return self._latest_path(tenant_id).exists()

    async def delete(self, tenant_id: TenantId) -> None:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            tenant_dir = self._tenant_dir(tenant_id)

            if not tenant_dir.exists():
                return

            entries = await asyncio.to_thread(lambda: list(tenant_dir.iterdir()))

            for entry in entries:
                if entry.is_file():
                    await asyncio.to_thread(entry.unlink)

            await asyncio.to_thread(tenant_dir.rmdir)

    async def list_versions(self, tenant_id: TenantId) -> list[int]:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            return await self._list_versions_unlocked(tenant_id)

    async def prune_old_versions(self, tenant_id: TenantId, keep_last_n: int) -> int:
        if keep_last_n < 1:
            raise ValueError("keep_last_n must be >= 1")

        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            versions = await self._list_versions_unlocked(tenant_id)
            versions_to_delete = (
                versions[:-keep_last_n] if len(versions) > keep_last_n else []
            )

            for version in versions_to_delete:
                await asyncio.to_thread(
                    self._artifact_path(tenant_id, version).unlink,
                    missing_ok=True,
                )

            return len(versions_to_delete)

    async def get_processed(
        self,
        tenant_id: TenantId,
        key: str,
    ) -> IdempotencyRecord | None:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            records = await self._read_idempotency_records_unlocked(tenant_id)
            record = records.get(key)

            if record is None:
                return None

            metadata_raw = record.get("metadata")

            if not isinstance(metadata_raw, dict):
                raise ModelStoreError("idempotency record metadata must be an object")

            metadata = self._metadata_from_manifest(metadata_raw)

            return IdempotencyRecord(
                key=key,
                metadata=metadata,
            )

    async def record_processed_once(
        self,
        tenant_id: TenantId,
        key: str,
        metadata: TipModelMetadata,
    ) -> IdempotencyRecord:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            tenant_dir = self._tenant_dir(tenant_id)
            await asyncio.to_thread(tenant_dir.mkdir, parents=True, exist_ok=True)

            records = await self._read_idempotency_records_unlocked(tenant_id)
            existing = records.get(key)

            if existing is not None:
                existing_metadata_raw = existing.get("metadata")

                if not isinstance(existing_metadata_raw, dict):
                    raise ModelStoreError(
                        "idempotency record metadata must be an object"
                    )

                existing_metadata = self._metadata_from_manifest(existing_metadata_raw)

                return IdempotencyRecord(
                    key=key,
                    metadata=existing_metadata,
                )

            record = {
                "metadata": {
                    "model_name": metadata.model_name,
                    "model_version": metadata.model_version,
                    "trained_count": metadata.trained_count,
                }
            }

            records[key] = record

            path = self._idempotency_path(tenant_id)
            tmp_path = path.with_name(f"{path.name}.tmp")

            await self._write_json_atomic(tmp_path, path, records)

            return IdempotencyRecord(
                key=key,
                metadata=metadata,
            )

    async def delete_tenant_records(self, tenant_id: TenantId) -> int:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            path = self._idempotency_path(tenant_id)

            if not path.exists():
                return 0

            records = await self._read_idempotency_records_unlocked(tenant_id)
            count = len(records)

            await asyncio.to_thread(path.unlink)

            return count

    async def _read_latest_manifest(
        self,
        tenant_id: TenantId,
    ) -> dict[str, Any] | None:
        """Public helper that acquires the tenant lock.

        Internal methods that already hold the tenant lock must call
        _read_latest_manifest_unlocked() directly to avoid deadlocks.
        """
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            return await self._read_latest_manifest_unlocked(tenant_id)

    async def _read_latest_manifest_unlocked(
        self,
        tenant_id: TenantId,
    ) -> dict[str, Any] | None:
        latest_path = self._latest_path(tenant_id)

        if not latest_path.exists():
            return None

        raw = await asyncio.to_thread(latest_path.read_text, encoding=UTF8)

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ArtifactIntegrityError("latest manifest is not valid JSON") from error

        if not isinstance(parsed, dict):
            raise ArtifactIntegrityError("latest manifest must be a JSON object")

        return parsed

    async def _read_idempotency_records_unlocked(
        self,
        tenant_id: TenantId,
    ) -> dict[str, Any]:
        path = self._idempotency_path(tenant_id)

        if not path.exists():
            return {}

        raw = await asyncio.to_thread(path.read_text, encoding=UTF8)

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ModelStoreError("idempotency file is not valid JSON") from error

        if not isinstance(parsed, dict):
            raise ModelStoreError("idempotency file must be a JSON object")

        return parsed

    async def _write_json_atomic(
        self,
        tmp_path: Path,
        final_path: Path,
        data: dict[str, Any],
    ) -> None:
        serialized = json.dumps(
            data,
            ensure_ascii=False,
            indent=JSON_INDENT,
            sort_keys=True,
        )

        await asyncio.to_thread(tmp_path.write_text, serialized, encoding=UTF8)
        await asyncio.to_thread(os.replace, tmp_path, final_path)

    async def _list_versions_unlocked(self, tenant_id: TenantId) -> list[int]:
        tenant_dir = self._tenant_dir(tenant_id)

        if not tenant_dir.exists():
            return []

        entries = await asyncio.to_thread(lambda: list(tenant_dir.iterdir()))

        versions: list[int] = []

        for entry in entries:
            if not entry.is_file():
                continue

            match = self._artifact_filename_pattern.fullmatch(entry.name)

            if match is None:
                continue

            versions.append(int(match.group(1)))

        return sorted(versions)

    def _verify_artifact_bytes(
        self,
        *,
        data: bytes,
        manifest: dict[str, Any],
        tenant_id: TenantId,
        metadata: TipModelMetadata,
    ) -> None:
        expected_sha256 = self._get_required_str(manifest, "sha256")
        actual_sha256 = hashlib.sha256(data).hexdigest()

        if not hmac.compare_digest(actual_sha256, expected_sha256):
            raise ArtifactIntegrityError("sha256 mismatch")

        signature = self._get_required_str(manifest, "signature")

        if not verify_artifact(
            data,
            signature,
            tenant_id=str(tenant_id),
            model_name=metadata.model_name,
            model_version=metadata.model_version,
        ):
            raise ArtifactIntegrityError("hmac signature mismatch")

    def _metadata_from_manifest(self, manifest: dict[str, Any]) -> TipModelMetadata:
        model_name = self._get_required_str(manifest, "model_name")

        if model_name != self._model_name:
            raise ArtifactIntegrityError("unexpected model name")

        model_version = self._get_required_positive_int(manifest, "model_version")
        trained_count = self._get_required_non_negative_int(
            manifest,
            "trained_count",
        )

        return TipModelMetadata(
            model_name=model_name,
            model_version=model_version,
            trained_count=trained_count,
        )

    def _get_required_str(self, data: dict[str, Any], key: str) -> str:
        value = data.get(key)

        if not isinstance(value, str) or value.strip() == "":
            raise ArtifactIntegrityError(
                f"manifest field {key} must be a non-empty string"
            )

        return value

    def _get_required_positive_int(self, data: dict[str, Any], key: str) -> int:
        value = data.get(key)

        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ArtifactIntegrityError(
                f"manifest field {key} must be a positive integer"
            )

        return value

    def _get_required_non_negative_int(self, data: dict[str, Any], key: str) -> int:
        value = data.get(key)

        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ArtifactIntegrityError(
                f"manifest field {key} must be a non-negative integer"
            )

        return value

    def _version_from_artifact_filename(self, filename: str) -> int:
        match = self._artifact_filename_pattern.fullmatch(filename)

        if match is None:
            raise ArtifactIntegrityError("invalid artifact filename")

        return int(match.group(1))
