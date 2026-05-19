# 📚 SmartTips - Database Documentation

> Comprehensive guide for any developer joining the SmartTips project.
> Read this **before** writing your first query against the database.

**Last updated**: 2026-05-19
**Schema version**: 1.0 (MVP)
**Maintainer**: Brydel Fosso Saounde ([@brydel](https://github.com/brydel))

---

## Table of contents

1. [Quick start](#-quick-start)
2. [Architecture overview](#-architecture-overview)
3. [Multi-tenant isolation strategy](#-multi-tenant-isolation-strategy)
4. [The 24 entities at a glance](#-the-24-entities-at-a-glance)
5. [Core design decisions (ADRs)](#-core-design-decisions-adrs)
6. [Naming conventions](#-naming-conventions)
7. [Security & compliance](#-security--compliance)
8. [Common patterns & how-tos](#-common-patterns--how-tos)
9. [Migrations workflow](#-migrations-workflow)
10. [Performance considerations](#-performance-considerations)
11. [Anti-patterns - what NOT to do](#-anti-patterns---what-not-to-do)
12. [FAQ](#-faq)

---

## 🚀 Quick start

```bash
# 1. Start the database
cd <repo-root>
docker compose up -d

# 2. Verify everything is healthy
docker compose ps
# postgres should show "Up (healthy)"
# redis should show "Up (healthy)"

# 3. Configure environment
cp .env.example apps/api/.env
# Edit DATABASE_URL if needed (defaults work for Docker Compose)

# 4. Run migrations
cd apps/api
pnpm prisma migrate dev

# 5. Seed demo data
pnpm prisma db seed

# 6. Open Prisma Studio (web UI for the DB)
pnpm prisma studio
# Opens http://localhost:5555

# 7. Alternative: Adminer at http://localhost:8080
#    Server:   postgres
#    User:     smarttips
#    Password: smarttips_dev_password
#    Database: smarttips_dev
```

---

## 🏗️ Architecture overview

SmartTips is a **multi-tenant SaaS** where each tenant is a restaurant (or franchise location). The database uses **row-level tenant isolation**: every business table contains a `tenant_id` column that scopes the data.

### Tech stack

- **PostgreSQL 16** (Docker Compose local, Neon serverless in prod)
- **Prisma 6** ORM (TypeScript client)
- **pgcrypto** extension for native UUID v4 generation
- **citext** extension for case-insensitive emails

### Repository layout

```
apps/api/
├── prisma/
│   ├── schema.prisma          # Source of truth for the schema
│   ├── migrations/            # Auto-generated migration files
│   │   ├── 20260519_init/
│   │   │   └── migration.sql
│   │   └── ...
│   └── seed.ts                # Demo data for development
└── src/                       # NestJS application code
```

---

## 🔒 Multi-tenant isolation strategy

This is **the most important concept** in this codebase. Read it twice.

### The principle

Every query against a business table **MUST** filter by `tenant_id`. A tenant must never see another tenant's data.

### Three layers of defense

We don't trust a single mechanism. Three layers ensure isolation:

#### Layer 1: Schema (this document)
Every business table has:
- A `tenant_id UUID NOT NULL` column with `ON DELETE CASCADE` to `tenants.id`
- An index on `tenant_id` (or a composite index starting with `tenant_id`)
- Unique constraints scoped per tenant (e.g., `UNIQUE (tenant_id, email)`)

#### Layer 2: Prisma middleware (BIS-7 / NestJS auth module)
A Prisma middleware intercepts every query and injects `WHERE tenant_id = ?` automatically based on the authenticated user's `tenantId` JWT claim. If you write `prisma.employee.findMany()`, the middleware silently appends the filter.

```typescript
// Pseudo-code of the middleware
prisma.$use(async (params, next) => {
  if (isMultiTenantModel(params.model)) {
    params.args.where = {
      ...params.args.where,
      tenantId: getCurrentRequestTenantId(),
    };
  }
  return next(params);
});
```

#### Layer 3: E2E tests
Tests in `apps/api/test/multi-tenant-isolation.e2e-spec.ts` create two tenants, log in as each, and verify that cross-tenant access returns `404 Not Found` (not `403`, to avoid leaking existence).

### Exceptions

Two tables **do not have** a direct `tenant_id`:

1. **`refresh_tokens`** — scoped via `user.tenant_id`
2. **`order_items`** — scoped via `order.tenant_id`

This is acceptable because:
- They never appear in queries without joining their parent
- Their access is implicitly tenant-scoped through the parent relation

### What happens if you forget the filter?

Without the middleware (e.g., raw SQL via `$queryRaw`), you must add `WHERE tenant_id = ?` yourself. **A missed filter is a data breach**. PRs that touch raw SQL get extra review.

---

## 🗂️ The 24 entities at a glance

Entities grouped by domain. The full ERD lives in `docs/architecture/03-database-erd.svg`.

### Core & Auth (4)
| Table | Purpose | Soft delete |
|-------|---------|-------------|
| `tenants` | Root: a restaurant / franchise location | ✅ |
| `users` | Login accounts (OWNER, MANAGER, EMPLOYEE) | ✅ |
| `refresh_tokens` | Hashed refresh tokens for JWT auth | ❌ |
| `invitations` | Email invites to join a tenant | ❌ |

### Human Resources (2)
| Table | Purpose | Soft delete |
|-------|---------|-------------|
| `employees` | Employee profiles (may or may not have a User account) | ✅ |
| `employee_role_history` | Track role changes over time | ❌ |

### Menu (2)
| Table | Purpose | Soft delete |
|-------|---------|-------------|
| `menu_categories` | Top-level menu categories | ❌ |
| `menu_items` | Individual dishes / drinks | ✅ |

### Shifts (2)
| Table | Purpose | Soft delete |
|-------|---------|-------------|
| `shifts` | A service (lunch / dinner) on a given day | ❌ |
| `shift_assignments` | Which employees worked which shift | ❌ |

### Orders (3)
| Table | Purpose | Soft delete |
|-------|---------|-------------|
| `restaurant_tables` | Physical tables in the restaurant | ❌ |
| `orders` | Customer bills | ❌ |
| `order_items` | Line items on a bill | ❌ |

### Tips (3) — **the heart of SmartTips**
| Table | Purpose | Soft delete |
|-------|---------|-------------|
| `tip_pools` | Total pool declared by manager per shift | ❌ |
| `tip_distributions` | How much each employee receives + WHY (JSONB explanation) | ❌ |
| `distribution_configs` | Per-tenant rules of distribution (one config per tenant) | ❌ |

### Machine Learning (4)
| Table | Purpose |
|-------|---------|
| `ml_models` | Metadata of per-tenant ML models (bytes in R2) |
| `ml_training_events` | Audit of every online learning step |
| `ml_predictions` | Predictions made by models (debugging + audit) |
| `fairness_audits` | Periodic algorithmic fairness checks |

### Audit & Billing (4)
| Table | Purpose | Notes |
|-------|---------|-------|
| `audit_logs` | Immutable trail of all sensitive actions | **NEVER DELETE** - 7 years retention |
| `payroll_exports` | Generated CSV/PDF for accounting | Tamper-proof via SHA-256 signature |
| `subscriptions` | Stripe subscription per tenant (V2) | One per tenant |
| `usage_metrics` | Monthly usage tracking (V2 billing) | |

---

## 📐 Core design decisions (ADRs)

Linked to `docs/adr/` in the repo.

### ADR-001: Row-level tenant isolation

**Chose**: `tenant_id` column on every business table.

**Why not schema-per-tenant or DB-per-tenant?**
- Schema-per-tenant: migration nightmare at scale (run on N schemas)
- DB-per-tenant: operational overhead, costly past 100 tenants
- Row-level: simple, scalable, low cost. Migrate to schema-per-tenant if metrics demand later.

### ADR-002: UUID v4 primary keys

**Chose**: `gen_random_uuid()` from pgcrypto for all IDs.

**Why not serial integers?**
- Integers are **enumerable** (attacker tries `/orders/123`, `/orders/124`)
- Integers leak business metrics (growth rate)
- Conflicts when merging databases (regions, M&A)

**Why v4 over v7?**
- Postgres 16 doesn't generate v7 natively (needs extension or Node-side gen)
- v7's insertion-locality benefits are minimal at our scale (<100M rows projected)
- Can migrate to v7 later if performance demands

### ADR-003: Decimal(10, 2) for money

**Chose**: `Decimal` with explicit precision for any monetary value.

**Why not Float or Double?**
- `0.1 + 0.2 = 0.30000000000000004` in IEEE 754
- Compound errors over thousands of tip calculations create accounting disputes
- Postgres `numeric(10, 2)` is exact and indexable

**Side effect**: in TypeScript code, `Decimal` values are `Decimal.js` objects. You cannot do `a + b` — use `a.plus(b)`.

### ADR-004: Soft delete on critical entities

**Chose**: `deleted_at` timestamp on tenants, users, employees, menu_items.

**Why?**
- Quebec Labour Standards Act: keep payroll/tip records for 6 years
- Re-hiring scenarios: an employee who quits and comes back keeps their history (and ML model context)
- Audit / compliance: tax auditors can look back 5 years

**Trade-off**: every query in business code needs `WHERE deleted_at IS NULL`. The Prisma middleware will inject this automatically (BIS-7).

### ADR-005: Postgres enums (not VARCHAR + CHECK)

**Chose**: native Postgres `ENUM` types via Prisma `enum`.

**Why?**
- Compact storage (1-2 bytes vs. VARCHAR overhead)
- Validation at DB layer (defense in depth)
- TypeScript autocomplete via generated `@prisma/client`
- Adding a value requires a migration — that's a **feature**, not a bug (forces deliberate change)

### ADR-006: JSONB for flexible fields

**Chose**: `Json` (JSONB) for `address`, `explanation`, `features_snapshot`, etc.

**Decision rule**: if you'll **query** the contents, make it a real column. If you'll just **read** the whole blob, make it JSONB.

Examples:
- `explanation` in `tip_distributions`: read whole, varies in structure → JSONB ✅
- `amount` in `tip_distributions`: queried via `SUM`, `GROUP BY` → column ✅

---

## 📝 Naming conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| Prisma model | `PascalCase` | `model Tenant` |
| Database table | `snake_case`, plural | `@@map("tenants")` |
| Prisma field | `camelCase` | `firstName` |
| Database column | `snake_case` | `@map("first_name")` |
| Foreign key | `<entity>_id` | `tenant_id`, `user_id` |
| Index name | auto-generated by Prisma, or `<entity>_<column>_idx` | |
| Unique constraint | explicit `name:` for clarity | `unique_user_email_per_tenant` |
| Enum (Prisma) | `PascalCase` | `enum UserRole` |
| Enum (DB) | `snake_case` | `@@map("user_role")` |
| Enum values | `SCREAMING_SNAKE_CASE` | `SUPER_ADMIN`, `OWNER` |

### Timestamps

Every mutable entity has:
```prisma
createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
updatedAt DateTime  @updatedAt      @map("updated_at") @db.Timestamptz(6)
```

We use `Timestamptz(6)` (timestamp **with** timezone, microsecond precision) — never naive timestamps. PostgreSQL stores everything as UTC and converts on display.

---

## 🔐 Security & compliance

### Sensitive data handling

| Data | Storage | Notes |
|------|---------|-------|
| Passwords | `users.hashed_password` | bcrypt, cost factor 12 |
| Refresh tokens | `refresh_tokens.token_hash` | SHA-256 of the raw token, NEVER store raw |
| Invitation tokens | `invitations.token_hash` | Same as above |
| Stripe customer IDs | `tenants.stripe_customer_id` | OK to store, not PII |
| Banking info | ❌ NOT IN DB | Use Stripe, never store ourselves |
| SSN / SIN | ❌ NEVER | Outside our scope |

### Defense in depth

1. **Network**: Postgres bound to `127.0.0.1` only (not exposed externally), Redis password-protected
2. **Transport**: TLS to managed Postgres in prod (Neon enforces it)
3. **Auth**: JWT short-lived access + DB-stored refresh tokens (revocable)
4. **Authorization**: Role-based (OWNER, MANAGER, EMPLOYEE) + tenant isolation
5. **Audit**: Every sensitive action logged to `audit_logs`

### The audit log invariant

```
audit_logs entries are IMMUTABLE.
Never UPDATE, never DELETE, even via Prisma.
Application code MUST NOT expose any endpoint that mutates this table.
```

In production we'd enforce this with a Postgres trigger or revoked DELETE permission. In development we trust the app layer.

### Compliance contexts

- **Quebec Labour Standards Act**: 6 years retention for payroll/tip records
- **Loi 25 (Quebec privacy)**: explicit consent for personal data use, right to delete
- **PIPEDA (Federal Canada)**: similar to GDPR for personal data
- **Restaurant audits**: Revenu Québec can request records up to 5 years back

We design for **7 years retention** on audit logs and tip records (1 year buffer above Quebec requirement).

---

## 🛠️ Common patterns & how-tos

### Inserting a tenant + owner (signup flow)

```typescript
await prisma.$transaction(async (tx) => {
  const tenant = await tx.tenant.create({
    data: { name: 'Le Bistro', slug: 'le-bistro', email: 'owner@bistro.com' },
  });

  const owner = await tx.user.create({
    data: {
      tenantId: tenant.id,
      email: 'owner@bistro.com',
      hashedPassword: await bcrypt.hash(password, 12),
      role: 'OWNER',
      name: 'Marie Tremblay',
    },
  });

  await tx.distributionConfig.create({
    data: {
      tenantId: tenant.id,
      mode: 'RULES_ONLY',
      roleCoefficients: { SERVER: 1.0, BARTENDER: 0.9, BUSSER: 0.7, HOST: 0.6, COOK: 0.5 },
      updatedBy: owner.id,
    },
  });

  return { tenant, owner };
});
```

**Why a transaction?** All three rows must exist or none. Without `$transaction`, a partial failure leaves orphan tenants without config.

### Listing employees of the current tenant

```typescript
// Thanks to the middleware, you do NOT write `tenantId` here:
const employees = await prisma.employee.findMany({
  where: {
    role: 'SERVER',
    active: true,
    deletedAt: null, // Soft-delete-aware
  },
  orderBy: { hireDate: 'desc' },
});
```

### Getting a shift with all assignments + tip pool

```typescript
const shift = await prisma.shift.findUnique({
  where: { id: shiftId },
  include: {
    assignments: {
      include: { employee: true },
      orderBy: { roleDuringShift: 'asc' },
    },
    tipPool: {
      include: { distributions: { include: { employee: true } } },
    },
    orders: {
      where: { status: 'PAID' },
      include: { items: true },
    },
  },
});
```

### Working with Decimal

```typescript
import { Prisma } from '@prisma/client';

const tip1 = new Prisma.Decimal('73.60');
const tip2 = new Prisma.Decimal('25.40');

// ❌ Wrong - returns a JS number, loses precision
const wrong = tip1 + tip2;

// ✅ Correct
const correct = tip1.plus(tip2); // Decimal { d: '99', e: 2, s: 1 }
console.log(correct.toFixed(2)); // "99.00"
```

### Serializing Decimal to JSON

```typescript
// Decimal objects don't serialize natively. Use .toFixed() at API boundary:
return {
  amount: distribution.amount.toFixed(2), // string "73.60"
};
// Frontend re-hydrates with new Decimal() if needed
```

---

## 🔄 Migrations workflow

### Local development

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate a migration (Prisma compares to your local DB)
pnpm prisma migrate dev --name <descriptive_name>

# Example:
pnpm prisma migrate dev --name add_employee_emergency_contact

# Output:
#   - Creates prisma/migrations/<timestamp>_<name>/migration.sql
#   - Applies it to your local DB
#   - Regenerates @prisma/client TypeScript types
```

### Naming migrations

Use the same conventions as commits: `<verb>_<noun>`.
- ✅ `add_employee_emergency_contact`
- ✅ `rename_tip_pool_status_enum`
- ✅ `drop_unused_invitation_index`
- ❌ `update` (what update?)
- ❌ `fix` (fix what?)

### Production deployment

```bash
# Production NEVER runs `migrate dev` - it would generate new migrations.
# Production runs:
pnpm prisma migrate deploy
# This applies any pending migrations from prisma/migrations/ without
# creating new ones.
```

### Migration immutability

**Rule**: a migration merged to `main` is **never modified**. If a migration has a bug, create a **new** migration that fixes it.

Why? Because once developers (and prod) have applied a migration, modifying its SQL won't re-apply. Drift between environments is born.

### Zero-downtime migrations

For changes that could lock tables or break running code, split into multiple deploys:

1. **Phase 1**: Add new column (nullable), keep old column. Deploy code that writes both.
2. **Phase 2**: Backfill old data into new column.
3. **Phase 3**: Deploy code that reads only the new column.
4. **Phase 4**: Drop the old column.

For SmartTips MVP we don't need this (no prod users yet), but document this pattern in interviews.

### Resetting a stuck local DB

```bash
# Nuclear option - drops EVERYTHING in the local DB and re-applies all migrations
pnpm prisma migrate reset
# Prompts for confirmation, then runs seed afterwards
```

**Never run `migrate reset` against a remote/prod database.**

---

## ⚡ Performance considerations

### Indexes

Strategy: index based on actual query patterns, not speculation.

**Always indexed** (already in schema):
- `tenant_id` on every business table (99% of queries filter on this)
- Composite `(tenant_id, frequently_filtered_column)` for common patterns:
  - `(tenant_id, role)` on employees
  - `(tenant_id, status)` on shifts
  - `(tenant_id, date)` on shifts
  - `(tenant_id, deleted_at)` on tenants, users

**Add later when profiling shows need**:
- Indexes for new query patterns introduced by V1 features
- Partial indexes (e.g., `WHERE deleted_at IS NULL`) if soft-delete queries are slow

### N+1 query prevention

```typescript
// ❌ N+1 - executes 1 + N queries
const shifts = await prisma.shift.findMany();
for (const shift of shifts) {
  const assignments = await prisma.shiftAssignment.findMany({
    where: { shiftId: shift.id },
  });
}

// ✅ 1 query - use include
const shifts = await prisma.shift.findMany({
  include: { assignments: true },
});
```

### Pagination

Never `findMany()` without `take`. Add cursor or offset pagination:

```typescript
const orders = await prisma.order.findMany({
  take: 50,
  cursor: lastSeenId ? { id: lastSeenId } : undefined,
  skip: lastSeenId ? 1 : 0,
  orderBy: { createdAt: 'desc' },
});
```

### Heavy reads → read replica (production)

Reports and analytics in V1+ should target a Neon read replica when traffic justifies it. Connection string via `READ_REPLICA_DATABASE_URL`.

---

## ⛔ Anti-patterns - what NOT to do

### 1. Bypassing the tenant middleware

```typescript
// ❌ Don't use $queryRaw without manually adding tenant_id
await prisma.$queryRaw`SELECT * FROM employees WHERE role = 'SERVER'`;
// This returns ALL employees from ALL tenants. DATA LEAK.

// ✅ If you must use raw SQL, always include the tenant filter
await prisma.$queryRaw`
  SELECT * FROM employees
  WHERE tenant_id = ${tenantId}::uuid
    AND role = 'SERVER'
    AND deleted_at IS NULL
`;
```

### 2. Hard-deleting employees

```typescript
// ❌ Hard delete - loses legal record
await prisma.employee.delete({ where: { id } });

// ✅ Soft delete
await prisma.employee.update({
  where: { id },
  data: { deletedAt: new Date(), active: false },
});
```

### 3. Using Float for money

```typescript
// ❌ Imprecise
const totalTip: number = 73.60 + 25.40; // might be 98.99999...

// ✅ Exact
import { Prisma } from '@prisma/client';
const totalTip = new Prisma.Decimal('73.60').plus('25.40');
```

### 4. Mutating audit logs

```typescript
// ❌ NEVER do this
await prisma.auditLog.update({ where: { id }, data: { newValues: ... } });
await prisma.auditLog.delete({ where: { id } });

// Audit logs are append-only.
```

### 5. Storing JWT in the database

```typescript
// ❌ The whole point of JWT is statelessness. Storing them defeats it.
await prisma.someTable.create({ data: { jwt: 'eyJhbG...' } });

// ✅ Store the hash of refresh tokens only (already done in schema)
```

### 6. Forgetting `@db.Timestamptz`

```prisma
// ❌ No timezone info, ambiguous
createdAt DateTime @default(now())

// ✅ Explicit timezone-aware
createdAt DateTime @default(now()) @db.Timestamptz(6)
```

### 7. Querying without scope

```typescript
// ❌ Returns everything globally
const tips = await prisma.tipDistribution.findMany();

// ✅ Always scope to a context (tenant_id is auto-injected by middleware,
// but explicit scoping makes intent clear)
const tips = await prisma.tipDistribution.findMany({
  where: { employeeId: currentEmployee.id },
  take: 100,
});
```

---

## ❓ FAQ

**Q: Why is `refresh_tokens.user_agent` a TEXT and not VARCHAR?**
A: User agents can be very long (Chrome with extensions can hit 1000+ chars). VARCHAR with arbitrary limits would cut data we might need for security analysis.

**Q: Why no `created_at` on `restaurant_tables`?**
A: Tables are configured once and rarely change. We accept the trade-off of less audit detail for a simpler model. Could be added later.

**Q: Why is `tip_pools.shift_id` `UNIQUE` instead of just `INDEX`?**
A: It's the database-level enforcement that **one shift has at most one pool**. If you try to insert a second pool for the same shift, Postgres rejects it. Application code could miss this, the DB cannot.

**Q: Can I add a column to an existing migration?**
A: **No.** Once a migration is on `main`, it's immutable. Create a new migration. See [Migration immutability](#migration-immutability).

**Q: Why are some FKs `Cascade` and others `Restrict`?**
A: 
- `Cascade`: child should be deleted with parent (e.g., delete tenant → delete all its users)
- `Restrict`: prevent deletion if children exist (e.g., can't delete an employee who has tip distributions)
- `SetNull`: child stays but its FK is nulled (e.g., user-deleted-by audit log keeps the log but nulls the FK)

The choice is per-relation in `schema.prisma`. When in doubt, default to `Restrict` and override if needed.

**Q: How do I see the SQL Prisma generates?**
A: Add `log: ['query']` to `new PrismaClient({ log: ['query'] })` in your code, or set `DEBUG=prisma:query` env var.

**Q: What's in `tip_distributions.explanation` JSON?**
A: A human-readable breakdown of the calculation. Example:
```json
{
  "method": "ML_ASSISTED",
  "modelVersion": "v1.2.0",
  "factors": {
    "coefficient": 1.0,
    "hoursWorked": 8.0,
    "salesGenerated": 1240.50,
    "salesBonus": 0.15
  },
  "score": 9.2,
  "totalPoolScore": 47.5,
  "yourShare": "9.2 / 47.5 = 19.4%",
  "computedAmount": 73.60,
  "humanReadable": "Coefficient SERVER (1.0) × 8h worked × 1.15 (sales bonus) = 9.2 points. Your share: 19.4% of the $380 pool."
}
```

**Q: Can two tenants have the same employee email?**
A: Yes. Email uniqueness is **per tenant** (`@@unique([tenantId, email])`). A person can work at two different restaurants.

**Q: Why is `MLModel.tenantId` required if R2 already stores per-tenant?**
A: Defense in depth. R2 path conventions can be misconfigured. The DB row guarantees that even if R2 paths are wrong, the model is tied to a tenant.

---

## 📚 Further reading

- [`docs/adr/`](../adr/) — Architecture Decision Records (the "why")
- [Prisma documentation](https://www.prisma.io/docs)
- [PostgreSQL JSONB best practices](https://www.postgresql.org/docs/current/datatype-json.html)
- Interview prep notes: [`../interview-prep/technical-decisions.md`](../../interview-prep/technical-decisions.md)

---

## 🤝 Contributing

When you modify the schema:

1. Update `schema.prisma`
2. Run `pnpm prisma migrate dev --name <descriptive_name>`
3. **Update this document** if you changed conventions, added a major entity, or shifted a design decision
4. Add an ADR in `docs/adr/` for non-obvious decisions
5. Open a PR — schema changes get extra scrutiny

Welcome aboard 🚀