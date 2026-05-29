import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status

from app.api.deps import get_model_service, get_storage_backend
from app.core.logging import get_logger, reset_request_id, set_request_id
from app.core.security import verify_internal_token
from app.schemas.predict import PredictRequest, PredictResponse
from app.schemas.train import TrainRequest, TrainResponse
from app.services.model_service import ModelService
from app.storage.base import (
    AppStorage,
    ArtifactIntegrityError,
    ArtifactNotFoundError,
    ConcurrentWriteError,
)

logger = get_logger(__name__)
router = APIRouter()

RequestIdHeader = Annotated[
    str | None,
    Header(
        alias="X-Request-Id",
        min_length=1,
        max_length=128,
        pattern=r"^[a-zA-Z0-9._-]+$",
        description="Optional request correlation ID propagated from the API gateway.",
    ),
]


async def request_context(
    request: Request,
    response: Response,
    x_request_id: RequestIdHeader = None,
) -> AsyncIterator[None]:
    request_id = x_request_id or str(uuid.uuid4())
    token = set_request_id(request_id)

    request.state.request_id = request_id
    response.headers["X-Request-Id"] = request_id

    try:
        yield
    finally:
        reset_request_id(token)


@router.get("/health", status_code=status.HTTP_200_OK)
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def health_ready(
    storage: Annotated[AppStorage, Depends(get_storage_backend)],
) -> dict[str, str]:
    try:
        await storage.exists(uuid.UUID(int=0))
    except Exception as error:
        logger.warning(
            "readiness_check_failed",
            extra={
                "error_type": type(error).__name__,
            },
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="error.health.storage_unavailable",
        ) from error

    return {"status": "ready"}


@router.post(
    "/predict",
    response_model=PredictResponse,
    dependencies=[Depends(verify_internal_token), Depends(request_context)],
)
async def predict(
    payload: PredictRequest,
    service: Annotated[ModelService, Depends(get_model_service)],
) -> PredictResponse:
    try:
        prediction, model_version = await service.predict(
            tenant_id=payload.tenant_id,
            features=payload.features.model_dump(mode="python"),
        )
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="error.model.invalid_features",
        ) from error
    except (ArtifactIntegrityError, ArtifactNotFoundError) as error:
        logger.warning(
            "model_predict_storage_failure",
            extra={
                "tenant_id": str(payload.tenant_id),
                "error_type": type(error).__name__,
            },
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="error.model.storage_unavailable",
        ) from error

    return PredictResponse(
        tenant_id=payload.tenant_id,
        shift_id=payload.shift_id,
        prediction=prediction,
        model_version=model_version,
    )


@router.post(
    "/train",
    response_model=TrainResponse,
    dependencies=[Depends(verify_internal_token), Depends(request_context)],
)
async def train(
    payload: TrainRequest,
    service: Annotated[ModelService, Depends(get_model_service)],
) -> TrainResponse:
    try:
        status_str, model_version = await service.train(
            tenant_id=payload.tenant_id,
            features=payload.features.model_dump(mode="python"),
            target=payload.target.tips_total,
            idempotency_key=payload.idempotency_key,
        )
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="error.model.invalid_training_payload",
        ) from error
    except ConcurrentWriteError as error:
        logger.warning(
            "model_train_concurrent_write",
            extra={
                "tenant_id": str(payload.tenant_id),
            },
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="error.model.concurrent_write",
        ) from error
    except (ArtifactIntegrityError, ArtifactNotFoundError) as error:
        logger.warning(
            "model_train_storage_failure",
            extra={
                "tenant_id": str(payload.tenant_id),
                "error_type": type(error).__name__,
            },
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="error.model.storage_unavailable",
        ) from error

    return TrainResponse(
        tenant_id=payload.tenant_id,
        shift_id=payload.shift_id,
        status=status_str,
        model_version=model_version,
    )