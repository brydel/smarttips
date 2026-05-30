from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, TypeAlias, TypeVar
from uuid import UUID

from app.models.tip_model import TipModelMetadata, TipModelWrapper

TenantId: TypeAlias = UUID
ModelT = TypeVar("ModelT")


@dataclass(frozen=True, slots=True, kw_only=True)
class IdempotencyRecord:
    key: str
    metadata: TipModelMetadata


class IdempotencyStore(Protocol):
    """Stores processed idempotency keys to deduplicate /train calls.

    Implementations must make record_processed_once atomic.
    A duplicated /train call must never train the same tenant/shift twice.
    """

    async def get_processed(
        self,
        tenant_id: TenantId,
        key: str,
    ) -> IdempotencyRecord | None:
        """Return the existing idempotency record when the key was already processed."""
        ...

    async def record_processed_once(
        self,
        tenant_id: TenantId,
        key: str,
        metadata: TipModelMetadata,
    ) -> IdempotencyRecord:
        """Atomically record a processed key.

        If the key already exists, return the existing record.
        If the key does not exist, insert it and return the new record.
        """
        ...

    async def delete_tenant_records(self, tenant_id: TenantId) -> int:
        """Delete all idempotency records for a tenant.

        Returns the number of deleted records.
        """
        ...


class ModelStore(Protocol[ModelT]):
    """Persists tenant-isolated River models.

    Implementations must verify artifact integrity before deserialization.
    """

    async def load(self, tenant_id: TenantId) -> ModelT | None:
        """Load the latest verified model for a tenant."""
        ...

    async def save(self, tenant_id: TenantId, model: ModelT) -> TipModelMetadata:
        """Persist the model atomically and return saved metadata."""
        ...

    async def load_metadata(self, tenant_id: TenantId) -> TipModelMetadata | None:
        """Load latest model metadata without deserializing the model artifact."""
        ...

    async def exists(self, tenant_id: TenantId) -> bool:
        """Return whether a persisted model exists for the tenant."""
        ...

    async def delete(self, tenant_id: TenantId) -> None:
        """Delete all persisted model artifacts for the tenant."""
        ...

    async def list_versions(self, tenant_id: TenantId) -> list[int]:
        """List persisted model versions for the tenant in ascending order."""
        ...

    async def prune_old_versions(self, tenant_id: TenantId, keep_last_n: int) -> int:
        """Delete old model versions while keeping the most recent N versions.

        Returns the number of deleted versions.
        """
        ...


class ModelStoreError(Exception):
    """Base exception for model storage failures."""


class ArtifactIntegrityError(ModelStoreError):
    """Raised when a model artifact fails integrity verification."""


class ArtifactNotFoundError(ModelStoreError):
    """Raised when an expected artifact is missing."""


class ConcurrentWriteError(ModelStoreError):
    """Raised when a concurrent write conflict is detected."""


class AppStorage(ModelStore[TipModelWrapper], IdempotencyStore, Protocol):
    """Application storage backend combining model persistence and idempotency."""
