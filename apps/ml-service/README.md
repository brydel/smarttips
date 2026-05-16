# @smarttips/ml-service

Python ML service for SmartTips. Provides online learning via River library.

## Setup

```bash
cd apps/ml-service
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e ".[dev]"
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
```

## Endpoints
- `GET /health` - Liveness check
- `POST /predict` - Score prediction for a batch of employees
- `POST /train` - Online learning step (incremental update)
- `GET /models/{tenant_id}` - Current model metadata
- `GET /metrics/{tenant_id}` - Performance metrics

## ML Pipeline
1. Feature engineering (one-hot encoding, standard scaling)
2. River pipeline (LinearRegression or HoeffdingTreeRegressor)
3. Per-tenant model isolation
4. Drift detection (ADWIN)
5. Fairness audit (demographic parity)
