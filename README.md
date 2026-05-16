# SmartTips

> SaaS multi-tenant for fair tip distribution with online ML learning.
> Built with NestJS, Next.js 14, FastAPI, River, and Prisma.

[![CI](https://github.com/brydel/smarttips/actions/workflows/ci.yml/badge.svg)](https://github.com/brydel/smarttips/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

## 🎯 Problem

Restaurant tip pooling is **opaque**, **subjective**, and a **source of conflict**.
Managers decide distributions "by feel" and employees don't trust the math.

## ✨ Solution

SmartTips centralizes service data (sales, hours, roles, tables served) and learns
each employee's actual contribution via an **online ML model** (River) that updates
in real-time. Every distribution comes with a **human-readable explanation**.

## 🏗️ Architecture

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui | Vercel |
| Backend API | NestJS + Prisma + PostgreSQL | Railway |
| ML Service | FastAPI + River + scikit-learn | Fly.io |
| Database | PostgreSQL (multi-tenant via tenant_id) | Neon |
| Cache/Queue | Redis + BullMQ | Railway |
| Model Storage | Cloudflare R2 | Cloudflare |

See [`docs/architecture/`](./docs/architecture/) for full diagrams.

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/brydel/smarttips.git
cd smarttips
pnpm install

# Setup env
cp .env.example .env
# Edit .env with your local Postgres credentials

# Database
pnpm --filter @smarttips/api prisma:migrate
pnpm --filter @smarttips/api prisma:seed

# Run everything in parallel
pnpm dev
```

Access:
- Web: http://localhost:3000
- API: http://localhost:3001 (Swagger: http://localhost:3001/docs)
- ML Service: http://localhost:8000 (docs: http://localhost:8000/docs)

## 📁 Repo Structure

```
smarttips/
├── apps/
│   ├── web/              # Next.js 14 frontend
│   ├── api/              # NestJS backend
│   └── ml-service/       # Python FastAPI ML service
├── packages/
│   ├── shared-types/     # Shared TS types
│   ├── eslint-config/    # Shared ESLint rules
│   └── tsconfig/         # Shared tsconfig base
├── docs/
│   ├── adr/              # Architecture Decision Records
│   └── architecture/     # Eraser diagrams (PNG/SVG)
├── interview-prep/       # Pitches, Q&A, lessons learned
└── .github/workflows/    # CI/CD pipelines
```

## 🧠 ML Approach

The model uses **online learning** (River library) — it updates incrementally
after each shift instead of batch retraining. Each tenant has its own model
that learns their team's patterns.

**Features**: role, hours_worked, sales_generated, day_of_week, is_weekend,
tables_served, avg_ticket_size, employee_tenure_days

**Target**: contribution_score (normalized, derived from manager adjustments)

**Cold start**: Falls back to rules-based algorithm for the first 30 shifts.

**Fairness**: Periodic audits detect bias against demographic groups.

See [`docs/adr/`](./docs/adr/) for the full rationale.

## 🛣️ Roadmap

- **MVP** (4 weeks) — Multi-tenant SaaS, rules + first ML model, demo restaurant
- **V1** (6 weeks) — Full online learning, explainability UI, multi-tenant signup
- **V2** (4 weeks) — Fairness dashboard, POS integration, mobile PWA, Stripe billing

## 🤝 Built by

Brydel Fosso Saounde — Computer Engineering student at La Cité Collégiale,
currently interning at Patrimoine canadien.

- LinkedIn: [your-linkedin]
- GitHub: [@brydel](https://github.com/brydel)

## 📄 License

MIT — see [LICENSE](./LICENSE)
