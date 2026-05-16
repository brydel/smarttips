# ADR-002: Authentication strategy

**Date**: 2026-05-16
**Status**: Accepted

## Context

SmartTips needs authentication that works for:
- Restaurant owners (web dashboard)
- Managers (web + tablet)
- Employees (mobile-first)
- Future: API clients (V2)

## Options considered

1. **Session cookies** — Server-side sessions, opaque session ID
2. **JWT only** — Stateless, no DB lookup per request
3. **JWT + refresh token in DB** — Hybrid: stateless access, revocable refresh
4. **Clerk / Auth0** — Managed auth provider

## Decision

We chose **option 3: JWT access (15min) + refresh token stored in DB (7 days)**.

Rationale:
- Stateless access tokens scale well (no DB hit per request)
- Refresh tokens in DB allow revocation (logout, password change, suspicious activity)
- Avoids vendor lock-in of managed providers
- Demonstrates auth knowledge in interviews (vs "I used Clerk")

## Consequences

- Need to implement token rotation carefully
- Must protect against refresh token theft (httpOnly cookies, IP/UA fingerprint)
- More code to maintain vs Clerk/Auth0
- Full control over UX (custom email templates, password rules)
