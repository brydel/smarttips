"""FastAPI entry point for SmartTips ML service."""
from fastapi import FastAPI

app = FastAPI(
    title="SmartTips ML Service",
    description="Online learning for fair tip distribution",
    version="0.1.0",
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}
