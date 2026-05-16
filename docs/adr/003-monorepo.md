# ADR-003: Monorepo with Turborepo

**Date**: 2026-05-16
**Status**: Accepted

## Context

SmartTips has 3 distinct apps (web, api, ml-service) that share types and
configuration. We need to choose between monorepo and polyrepo.

## Options considered

1. **Polyrepo** — 3 separate GitHub repos
2. **Monorepo with npm workspaces** — Simple, no extra tooling
3. **Monorepo with Turborepo** — Build orchestration, caching
4. **Monorepo with Nx** — More features, steeper learning curve

## Decision

We chose **Turborepo**.

Rationale:
- Faster than vanilla npm workspaces (parallel builds, cache)
- Less complex than Nx (no extra schematics to learn)
- Industry standard for TypeScript monorepos in 2026
- The Python ML service lives in the same repo but outside the TS workspace
  (managed by Poetry separately)

## Consequences

- Single source of truth for the whole project
- Atomic commits across web + api are possible
- CI must be configured to build/test only affected packages
