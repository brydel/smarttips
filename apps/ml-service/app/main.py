from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.api.routes import router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging

setup_logging()

logger = get_logger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        response = await call_next(request)

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("Pragma", "no-cache")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")

        if request.url.scheme == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )

        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()

    logger.info(
        "app_startup",
        extra={
            "service_name": settings.app_name,
            "environment": settings.app_env,
            "storage_backend": settings.storage_backend,
        },
    )

    yield

    logger.info("app_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="SmartTips ML Service",
        version="0.1.0",
        lifespan=lifespan,
        openapi_url="/openapi.json" if not settings.is_production else None,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.include_router(router, prefix="/v1")

    return app


app = create_app()


def run() -> None:
    settings = get_settings()

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # noqa: S104 - required for container networking
        port=8000,
        log_config=None,
        log_level=settings.log_level.lower(),
        reload=settings.is_development,
        proxy_headers=True,
        forwarded_allow_ips="*",
        server_header=False,
        date_header=False,
        access_log=False,
    )


if __name__ == "__main__":
    run()