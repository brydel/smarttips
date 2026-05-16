# ADR-005: River for online learning

**Date**: 2026-05-16
**Status**: Accepted

## Context

The ML model must learn each restaurant's patterns over time. We need to
decide between batch retraining and online (incremental) learning.

## Options considered

1. **Batch retraining with scikit-learn** — Periodically retrain on all data
2. **Online learning with River** — Update model with each new shift
3. **Hybrid: batch base + online fine-tuning**

## Decision

We chose **option 2: online learning with River**.

Rationale:
- Each shift naturally produces ground truth (manager's final distribution)
- Restaurants want immediate feedback, not weekly retrains
- River is mature (active since 2019, used in production at Decathlon, Mercari)
- Demonstrates ML maturity in interviews (rare for junior devs)
- Concept drift detection (ADWIN) built into River

## Consequences

- More complex than batch (state management, model versioning)
- Per-tenant model isolation (each restaurant gets its own model file in R2)
- Must implement cold-start strategy (fallback to rules for first 30 shifts)
- Periodic checkpoints to R2 for disaster recovery
