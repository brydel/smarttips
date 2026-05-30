from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import io
import json
import re
from typing import Any, Final, Generic, TypeVar, cast
from uuid import UUID

import boto3
import joblib
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

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

S3_NOT_FOUND_CODES: Final[frozenset[str]] = frozenset(
    {
        "404",
        "NoSuchKey",
        "NotFound",
    }
)

StoredModelT = TypeVar("StoredModelT", bound=PersistableModel)


class R2ModelStore(Generic[StoredModelT]):
    def __init__(
        self,
        *,
        artifact_config: ModelArtifactConfig | None = None,
    ) -> None:
        self._settings = get_settings()

        if self._settings.r2_bucket is None:
            raise ModelStoreError("r2_bucket is not configured")

        if self._settings.r2_endpoint is None:
            raise ModelStoreError("r2_endpoint is not configured")

        if self._settings.r2_access_key_value() is None:
            raise ModelStoreError("r2_access_key is not configured")

        if self._settings.r2_secret_key_value() is None:
            raise ModelStoreError("r2_secret_key is not configured")

        self._bucket = self._settings.r2_bucket
        config = artifact_config or tip_model_artifact_config()
        self._model_name = config.model_name
        self._artifact_prefix = config.artifact_prefix
        self._latest_key_suffix = config.latest_filename
        self._idempotency_key_suffix = config.idempotency_filename
        self._wrapper_factory = config.wrapper_factory
        self._artifact_key_pattern = re.compile(
            rf"^models/([0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-"
            rf"[0-9a-f]{{4}}-[0-9a-f]{{12}})/"
            rf"{re.escape(self._artifact_prefix)}([1-9][0-9]*)"
            rf"{re.escape(ARTIFACT_SUFFIX)}$"
        )

        self._client = boto3.client(
            "s3",
            endpoint_url=str(self._settings.r2_endpoint),
            aws_access_key_id=self._settings.r2_access_key_value(),
            aws_secret_access_key=self._settings.r2_secret_key_value(),
            config=BotoConfig(
                signature_version="s3v4",
                retries={
                    "max_attempts": 3,
                    "mode": "standard",
                },
                connect_timeout=self._settings.request_timeout_seconds,
                read_timeout=self._settings.request_timeout_seconds,
            ),
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

    def _tenant_prefix(self, tenant_id: TenantId) -> str:
        return f"models/{tenant_id}"

    def _artifact_key(self, tenant_id: TenantId, version: int) -> str:
        if version < 1:
            raise ValueError("artifact version must be greater than or equal to 1")

        return f"{self._tenant_prefix(tenant_id)}/{self._artifact_prefix}{version}{ARTIFACT_SUFFIX}"

    def _latest_key(self, tenant_id: TenantId) -> str:
        return f"{self._tenant_prefix(tenant_id)}/{self._latest_key_suffix}"

    def _idempotency_key(self, tenant_id: TenantId) -> str:
        return f"{self._tenant_prefix(tenant_id)}/{self._idempotency_key_suffix}"

    def _is_not_found(self, error: ClientError) -> bool:
        return error.response.get("Error", {}).get("Code") in S3_NOT_FOUND_CODES

    async def load(self, tenant_id: TenantId) -> StoredModelT | None:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            manifest = await self._read_manifest_unlocked(tenant_id)

            if manifest is None:
                return None

            metadata = self._metadata_from_manifest(manifest)

            artifact_key = self._get_required_str(manifest, "artifact_key")
            artifact_tenant_id, artifact_version = self._parse_artifact_key(artifact_key)

            if artifact_tenant_id != tenant_id:
                raise ArtifactIntegrityError("artifact key tenant does not match request tenant")

            if artifact_version != metadata.model_version:
                raise ArtifactIntegrityError("artifact key version does not match metadata")

            data = await self._get_object_bytes(artifact_key)

            if data is None:
                raise ArtifactNotFoundError(f"artifact missing for v{metadata.model_version}")

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

    async def save(self, tenant_id: TenantId, model: StoredModelT) -> TipModelMetadata:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            current_manifest = await self._read_manifest_unlocked(tenant_id)

            if current_manifest is not None:
                current_metadata = self._metadata_from_manifest(current_manifest)

                if model.version <= current_metadata.model_version:
                    raise ConcurrentWriteError(
                        f"v{model.version} <= persisted v{current_metadata.model_version}"
                    )

            buffer = io.BytesIO()
            await asyncio.to_thread(joblib.dump, model.model, buffer)
            data = buffer.getvalue()

            sha256 = hashlib.sha256(data).hexdigest()
            signature = sign_artifact(
                data,
                tenant_id=str(tenant_id),
                model_name=self._model_name,
                model_version=model.version,
            )

            artifact_key = self._artifact_key(tenant_id, model.version)

            await self._put_object_bytes(
                artifact_key,
                data,
                content_type="application/octet-stream",
            )

            manifest = {
                "model_name": self._model_name,
                "model_version": model.version,
                "trained_count": model.trained_count,
                "sha256": sha256,
                "signature": signature,
                "artifact_key": artifact_key,
            }

            await self._put_json(
                self._latest_key(tenant_id),
                manifest,
            )

            return model.metadata

    async def load_metadata(self, tenant_id: TenantId) -> TipModelMetadata | None:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            manifest = await self._read_manifest_unlocked(tenant_id)

            if manifest is None:
                return None

            return self._metadata_from_manifest(manifest)

    async def exists(self, tenant_id: TenantId) -> bool:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            manifest = await self._read_manifest_unlocked(tenant_id)
            return manifest is not None

    async def delete(self, tenant_id: TenantId) -> None:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            keys = await self._list_keys(self._tenant_prefix(tenant_id))

            for key in keys:
                await self._delete_object(key)

    async def list_versions(self, tenant_id: TenantId) -> list[int]:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            return await self._list_versions_unlocked(tenant_id)

    async def prune_old_versions(self, tenant_id: TenantId, keep_last_n: int) -> int:
        if keep_last_n < 1:
            raise ValueError("keep_last_n must be greater than or equal to 1")

        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            manifest = await self._read_manifest_unlocked(tenant_id)
            latest_version: int | None = None

            if manifest is not None:
                latest_version = self._metadata_from_manifest(manifest).model_version

            versions = await self._list_versions_unlocked(tenant_id)
            candidates = versions[:-keep_last_n] if len(versions) > keep_last_n else []

            deleted_count = 0

            for version in candidates:
                if latest_version is not None and version == latest_version:
                    continue

                await self._delete_object(self._artifact_key(tenant_id, version))
                deleted_count += 1

            return deleted_count

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
            records = await self._read_idempotency_records_unlocked(tenant_id)
            existing = records.get(key)

            if existing is not None:
                existing_metadata_raw = existing.get("metadata")

                if not isinstance(existing_metadata_raw, dict):
                    raise ModelStoreError("idempotency record metadata must be an object")

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

            await self._put_json(
                self._idempotency_key(tenant_id),
                records,
            )

            return IdempotencyRecord(
                key=key,
                metadata=metadata,
            )

    async def delete_tenant_records(self, tenant_id: TenantId) -> int:
        lock = await self._get_tenant_lock(tenant_id)

        async with lock:
            records = await self._read_idempotency_records_unlocked(tenant_id)
            count = len(records)

            if count == 0:
                return 0

            await self._delete_object(self._idempotency_key(tenant_id))

            return count

    async def _read_manifest_unlocked(self, tenant_id: TenantId) -> dict[str, Any] | None:
        data = await self._get_object_bytes(self._latest_key(tenant_id))

        if data is None:
            return None

        return self._decode_json_object(data, "manifest")

    async def _read_idempotency_records_unlocked(self, tenant_id: TenantId) -> dict[str, Any]:
        data = await self._get_object_bytes(self._idempotency_key(tenant_id))

        if data is None:
            return {}

        return self._decode_json_object(data, "idempotency file")

    async def _get_object_bytes(self, key: str) -> bytes | None:
        def _get() -> bytes | None:
            try:
                response = self._client.get_object(
                    Bucket=self._bucket,
                    Key=key,
                )
                body = response["Body"]

                try:
                    return cast(bytes, body.read())
                finally:
                    body.close()
            except ClientError as error:
                if self._is_not_found(error):
                    return None

                raise

        return await asyncio.to_thread(_get)

    async def _put_object_bytes(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str,
    ) -> None:
        content_md5 = base64.b64encode(hashlib.md5(data, usedforsecurity=False).digest()).decode(
            UTF8
        )

        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            ContentMD5=content_md5,
            ServerSideEncryption="AES256",
        )

    async def _put_json(
        self,
        key: str,
        data: dict[str, Any],
    ) -> None:
        serialized = json.dumps(
            data,
            ensure_ascii=False,
            indent=JSON_INDENT,
            sort_keys=True,
        ).encode(UTF8)

        await self._put_object_bytes(
            key,
            serialized,
            content_type="application/json",
        )

    async def _delete_object(self, key: str) -> None:
        try:
            await asyncio.to_thread(
                self._client.delete_object,
                Bucket=self._bucket,
                Key=key,
            )
        except ClientError as error:
            if self._is_not_found(error):
                return

            raise

    async def _list_keys(self, prefix: str) -> list[str]:
        def _list() -> list[str]:
            paginator = self._client.get_paginator("list_objects_v2")
            keys: list[str] = []

            for page in paginator.paginate(
                Bucket=self._bucket,
                Prefix=prefix,
            ):
                for item in page.get("Contents", []):
                    key = item.get("Key")

                    if isinstance(key, str):
                        keys.append(key)

            return keys

        return await asyncio.to_thread(_list)

    async def _list_versions_unlocked(self, tenant_id: TenantId) -> list[int]:
        keys = await self._list_keys(self._tenant_prefix(tenant_id))

        versions: list[int] = []

        for key in keys:
            match = self._artifact_key_pattern.fullmatch(key)

            if match is None:
                continue

            key_tenant_id = UUID(match.group(1))

            if key_tenant_id != tenant_id:
                continue

            versions.append(int(match.group(2)))

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

    def _decode_json_object(self, data: bytes, label: str) -> dict[str, Any]:
        try:
            parsed = json.loads(data.decode(UTF8))
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ArtifactIntegrityError(f"{label} is not valid JSON") from error

        if not isinstance(parsed, dict):
            raise ArtifactIntegrityError(f"{label} must be a JSON object")

        return parsed

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
            raise ArtifactIntegrityError(f"manifest field {key} must be a non-empty string")

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

    def _parse_artifact_key(self, key: str) -> tuple[TenantId, int]:
        match = self._artifact_key_pattern.fullmatch(key)

        if match is None:
            raise ArtifactIntegrityError("invalid artifact key")

        return UUID(match.group(1)), int(match.group(2))
