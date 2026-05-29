import hashlib
import hmac
import re
from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.config import get_settings

SIGNATURE_VERSION = "v1"
SIGNATURE_ALGORITHM = "hmac-sha256"
SIGNATURE_HEX_LENGTH = 64


async def verify_internal_token(
    x_internal_token: Annotated[
        str,
        Header(
            alias="X-Internal-Token",
            min_length=32,
            description="Internal service-to-service token used by the NestJS API.",
        ),
    ],
) -> None:
    settings = get_settings()
    expected_token = settings.internal_token_value()

    if not hmac.compare_digest(x_internal_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="error.auth.invalid_internal_token",
            headers={"WWW-Authenticate": "Internal"},
        )


def sign_artifact(
    data: bytes,
    *,
    tenant_id: str,
    model_name: str,
    model_version: int,
) -> str:
    signing_payload = _build_artifact_signing_payload(
        data=data,
        tenant_id=tenant_id,
        model_name=model_name,
        model_version=model_version,
    )

    settings = get_settings()
    secret = settings.model_artifact_secret_value().encode("utf-8")

    digest = hmac.new(
        secret,
        signing_payload,
        hashlib.sha256,
    ).hexdigest()

    return f"{SIGNATURE_VERSION}:{SIGNATURE_ALGORITHM}:{digest}"


def verify_artifact(
    data: bytes,
    signature: str,
    *,
    tenant_id: str,
    model_name: str,
    model_version: int,
) -> bool:
    if not _is_valid_signature_format(signature):
        return False

    expected_signature = sign_artifact(
        data,
        tenant_id=tenant_id,
        model_name=model_name,
        model_version=model_version,
    )

    return hmac.compare_digest(expected_signature, signature)


def _build_artifact_signing_payload(
    *,
    data: bytes,
    tenant_id: str,
    model_name: str,
    model_version: int,
) -> bytes:
    if model_version < 1:
        raise ValueError("model_version must be greater than or equal to 1")

    data_sha256 = hashlib.sha256(data).hexdigest()

    payload = "\n".join(
        [
            f"signature_version={SIGNATURE_VERSION}",
            f"signature_algorithm={SIGNATURE_ALGORITHM}",
            f"tenant_id={tenant_id}",
            f"model_name={model_name}",
            f"model_version={model_version}",
            f"data_sha256={data_sha256}",
        ]
    )

    return payload.encode("utf-8")


_HEX_DIGEST_PATTERN = re.compile(r'^[0-9a-f]{64}$')

def _is_valid_signature_format(signature: str) -> bool:
    parts = signature.split(":")
    if len(parts) != 3:
        return False
    version, algorithm, digest = parts
    if version != SIGNATURE_VERSION:
        return False
    if algorithm != SIGNATURE_ALGORITHM:
        return False
    return _HEX_DIGEST_PATTERN.match(digest) is not None