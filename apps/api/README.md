# @smarttips/api

NestJS backend API for SmartTips.

## Modules
- `auth/` - JWT + refresh tokens, multi-tenant
- `tenant/` - Tenant management, isolation middleware
- `employees/`, `menu/`, `shifts/`, `orders/` - Business CRUD
- `tip-pool/`, `distribution/` - Tip pooling and distribution
- `ml-client/` - Communication with Python ML service
- `reports/` - CSV/PDF exports
- `audit/` - Audit trail interceptor

## Database
PostgreSQL via Prisma. Multi-tenant by `tenant_id` row-level isolation.

## Run
```bash
pnpm dev
# API: http://localhost:3001
# Swagger: http://localhost:3001/docs
```
