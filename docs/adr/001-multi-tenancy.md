# ADR-001: Multi-tenancy strategy

**Date**: 2026-05-16
**Status**: Accepted

## Context

SmartTips is a SaaS that serves multiple restaurants. Each restaurant's data
must be **strictly isolated** from others — a tenant should never see another
tenant's employees, sales, or pourboires.

## Options considered

1. **Database per tenant** — One Postgres DB per restaurant
   - Pros: Strongest isolation, easy backups per tenant
   - Cons: Operational overhead, costly at scale, complex migrations

2. **Schema per tenant** — One Postgres schema per restaurant in shared DB
   - Pros: Good isolation, single connection pool
   - Cons: Migration complexity (run on N schemas), schema sprawl

3. **Row-level isolation with `tenant_id`** — Single DB, single schema, every
   business table has `tenant_id` column with index
   - Pros: Simple, scales well, easy migrations, low cost
   - Cons: Risk of "leaks" if `tenant_id` filter forgotten

## Decision

We chose **option 3: row-level isolation with `tenant_id`**.

To mitigate the leak risk, we enforce it at **multiple layers**:
- Prisma middleware automatically adds `WHERE tenant_id = ?` on every query
- A NestJS guard injects `req.user.tenantId` from the JWT claim
- E2E tests verify cross-tenant access returns 404 (not 403, to avoid leaking existence)

## Consequences

- Simpler operations and lower infrastructure cost
- Critical: the middleware MUST be tested rigorously — a bug there leaks all data
- Future migration to schema-per-tenant remains possible if scale demands it
