-- ============================================================================
-- SmartTips - PostgreSQL initialization script
-- ============================================================================
-- This script runs ONCE when the Postgres container is first created.
-- It sets up extensions needed by Prisma and the application.
--
-- If you need to re-run this (e.g., after schema changes):
--   docker compose down -v   # WARNING: deletes all data
--   docker compose up -d
-- ============================================================================

-- pgcrypto: provides gen_random_uuid() for UUID v4 generation
-- Used as default for all primary keys in our schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- citext: case-insensitive text type
-- Useful for emails (we want "Marie@bistro.com" = "marie@bistro.com")
CREATE EXTENSION IF NOT EXISTS citext;

-- pg_trgm: trigram matching for fuzzy text search
-- Will be used in V2 for employee/menu search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- btree_gin: GIN indexes on scalar types
-- Improves performance of JSONB queries (used in audit_logs, ml_predictions)
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Confirm extensions are loaded
SELECT
  e.extname AS extension_name,
  e.extversion AS version
FROM pg_extension e
WHERE e.extname IN ('pgcrypto', 'citext', 'pg_trgm', 'btree_gin')
ORDER BY e.extname;