# ADR-004: Separate Python ML service

**Date**: 2026-05-16
**Status**: Accepted

## Context

The ML logic could either be embedded in NestJS (TypeScript) or run as a
separate Python service. We need to decide.

## Options considered

1. **TensorFlow.js in NestJS** — Keep everything in TypeScript
2. **ONNX runtime in NestJS** — Load pre-trained models in TS
3. **Separate Python service (FastAPI)** — Use Python ML ecosystem

## Decision

We chose **option 3: separate Python FastAPI service**.

Rationale:
- **River** (our chosen online learning library) is Python-only
- scikit-learn / scipy ecosystem is far richer in Python than JS
- Service separation enables independent scaling (CPU-intensive ML vs I/O API)
- Standard architecture in production ML systems
- Failure isolation: ML crash doesn't bring down the API

## Consequences

- One more service to deploy and monitor
- Inter-service communication via REST (mitigated by HMAC auth)
- Two languages in the codebase (TypeScript + Python)
- Worth the cost: aligns with industry standard
