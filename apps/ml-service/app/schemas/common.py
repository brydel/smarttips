from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.types import UuidVersion

UUID4 = Annotated[UUID, UuidVersion(4)]


class StrictBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        str_strip_whitespace=True,
        validate_assignment=True,
        validate_default=True,
    )


class TenantScopedRequest(StrictBase):
    tenant_id: UUID4 = Field(
        description="Tenant UUID v4. Every model operation is isolated by tenant.",
        examples=["7f4d3c2a-1b0e-4c9f-8a6d-2e5f7b8c9d01"],
    )


class ShiftScopedRequest(TenantScopedRequest):
    shift_id: UUID4 = Field(
        description="Shift UUID v4 associated with the prediction or training event.",
        examples=["f15dfc77-72fb-4586-9f36-672cfb76f69b"],
    )