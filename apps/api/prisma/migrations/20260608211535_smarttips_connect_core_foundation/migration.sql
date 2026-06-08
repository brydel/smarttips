-- CreateEnum
CREATE TYPE "integration_provider" AS ENUM ('SQUARE_POS', 'CLOVER_POS', 'TOAST_POS', 'LIGHTSPEED_POS', 'TOUCHBISTRO_POS', 'UNIVERSAL_POS_IMPORT', 'QUICKBOOKS_ONLINE', 'XERO', 'RESEND', 'TWILIO', 'STRIPE');

-- CreateEnum
CREATE TYPE "integration_category" AS ENUM ('DIRECT_API', 'PARTNER_GATED', 'IMPORT_ASSISTANT', 'EXPORT', 'NOTIFICATION', 'BILLING');

-- CreateEnum
CREATE TYPE "integration_environment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "integration_account_status" AS ENUM ('PENDING', 'CONNECTED', 'NEEDS_REAUTH', 'PAUSED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "integration_credential_kind" AS ENUM ('OAUTH_ACCESS_TOKEN', 'OAUTH_REFRESH_TOKEN', 'API_KEY', 'WEBHOOK_SECRET', 'CLIENT_SECRET_REFERENCE');

-- CreateEnum
CREATE TYPE "integration_credential_status" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ROTATING');

-- CreateEnum
CREATE TYPE "integration_external_type" AS ENUM ('LOCATION', 'EMPLOYEE', 'SHIFT', 'ORDER', 'PAYMENT', 'TIP', 'TIME_ENTRY', 'ACCOUNTING_ACCOUNT');

-- CreateEnum
CREATE TYPE "integration_internal_type" AS ENUM ('TENANT', 'EMPLOYEE', 'SHIFT', 'ORDER', 'TIP_POOL', 'ASSIGNMENT', 'REPORT', 'ACCOUNTING_EXPORT');

-- CreateEnum
CREATE TYPE "integration_mapping_status" AS ENUM ('UNMAPPED', 'MAPPED', 'IGNORED', 'CONFLICT', 'STALE');

-- CreateEnum
CREATE TYPE "integration_mapping_matched_by" AS ENUM ('AUTO', 'MANUAL', 'IMPORT_PRESET', 'SYSTEM');

-- CreateEnum
CREATE TYPE "integration_sync_job_type" AS ENUM ('FULL_SYNC', 'INCREMENTAL_SYNC', 'WEBHOOK_RECONCILE', 'IMPORT_APPLY', 'EXPORT');

-- CreateEnum
CREATE TYPE "integration_sync_job_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL_FAILED', 'FAILED', 'CANCELED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "integration_health_severity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "integration_health_status" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "integration_health_event_type" AS ENUM ('TOKEN_EXPIRING', 'TOKEN_EXPIRED', 'RATE_LIMITED', 'SYNC_FAILED', 'WEBHOOK_FAILED', 'MAPPING_CONFLICT', 'PROVIDER_DEGRADED', 'IMPORT_ANOMALY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_action" ADD VALUE 'INTEGRATION_ACCOUNT_CREATED';
ALTER TYPE "audit_action" ADD VALUE 'INTEGRATION_ACCOUNT_STATUS_CHANGED';
ALTER TYPE "audit_action" ADD VALUE 'INTEGRATION_MAPPING_CREATED';
ALTER TYPE "audit_action" ADD VALUE 'INTEGRATION_SYNC_JOB_CREATED';
ALTER TYPE "audit_action" ADD VALUE 'INTEGRATION_HEALTH_EVENT_RECORDED';

-- CreateTable
CREATE TABLE "integration_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "provider" "integration_provider" NOT NULL,
    "category" "integration_category" NOT NULL,
    "environment" "integration_environment" NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "external_account_id" VARCHAR(255),
    "external_merchant_id" VARCHAR(255),
    "status" "integration_account_status" NOT NULL DEFAULT 'PENDING',
    "capabilities" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "connected_by_id" UUID,
    "disconnected_by_id" UUID,
    "connected_at" TIMESTAMPTZ(6),
    "last_sync_at" TIMESTAMPTZ(6),
    "disconnected_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "integration_account_id" UUID NOT NULL,
    "kind" "integration_credential_kind" NOT NULL,
    "status" "integration_credential_status" NOT NULL DEFAULT 'ACTIVE',
    "encrypted_payload" TEXT NOT NULL,
    "encryption_key_version" VARCHAR(100) NOT NULL,
    "scopes" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "last_refreshed_at" TIMESTAMPTZ(6),
    "rotated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_external_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "integration_account_id" UUID NOT NULL,
    "provider" "integration_provider" NOT NULL,
    "external_type" "integration_external_type" NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "internal_type" "integration_internal_type" NOT NULL,
    "internal_id" UUID NOT NULL,
    "display_name" VARCHAR(255),
    "status" "integration_mapping_status" NOT NULL DEFAULT 'UNMAPPED',
    "matched_by" "integration_mapping_matched_by" NOT NULL,
    "confidence" DECIMAL(5,4),
    "canonical_hash" VARCHAR(64),
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "integration_external_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "integration_account_id" UUID,
    "provider" "integration_provider" NOT NULL,
    "job_type" "integration_sync_job_type" NOT NULL,
    "status" "integration_sync_job_status" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" VARCHAR(255) NOT NULL,
    "cursor_from" JSONB,
    "cursor_to" JSONB,
    "requested_by_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "next_retry_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "error_code" VARCHAR(100),
    "safe_error_message" TEXT,
    "stats" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_health_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "integration_account_id" UUID,
    "provider" "integration_provider" NOT NULL,
    "severity" "integration_health_severity" NOT NULL,
    "status" "integration_health_status" NOT NULL DEFAULT 'OPEN',
    "event_type" "integration_health_event_type" NOT NULL,
    "message_key" VARCHAR(255) NOT NULL,
    "safe_details" JSONB NOT NULL,
    "correlation_id" VARCHAR(255),
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_health_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_accounts_tenant_id_idx" ON "integration_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "integration_accounts_tenant_id_provider_idx" ON "integration_accounts"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "integration_accounts_tenant_id_status_idx" ON "integration_accounts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "integration_accounts_tenant_id_provider_status_idx" ON "integration_accounts"("tenant_id", "provider", "status");

-- CreateIndex
CREATE INDEX "integration_accounts_tenant_id_deleted_at_idx" ON "integration_accounts"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "integration_accounts_connected_by_id_idx" ON "integration_accounts"("connected_by_id");

-- CreateIndex
CREATE INDEX "integration_accounts_disconnected_by_id_idx" ON "integration_accounts"("disconnected_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_accounts_tenant_id_provider_external_account_id_key" ON "integration_accounts"("tenant_id", "provider", "external_account_id", "environment");

-- CreateIndex
CREATE INDEX "integration_credentials_tenant_id_integration_account_id_idx" ON "integration_credentials"("tenant_id", "integration_account_id");

-- CreateIndex
CREATE INDEX "integration_credentials_tenant_id_status_idx" ON "integration_credentials"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "integration_credentials_expires_at_idx" ON "integration_credentials"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_integration_account_id_kind_key" ON "integration_credentials"("integration_account_id", "kind");

-- CreateIndex
CREATE INDEX "integration_external_mappings_tenant_id_integration_account_idx" ON "integration_external_mappings"("tenant_id", "integration_account_id");

-- CreateIndex
CREATE INDEX "integration_external_mappings_tenant_id_external_type_idx" ON "integration_external_mappings"("tenant_id", "external_type");

-- CreateIndex
CREATE INDEX "integration_external_mappings_tenant_id_internal_type_inter_idx" ON "integration_external_mappings"("tenant_id", "internal_type", "internal_id");

-- CreateIndex
CREATE INDEX "integration_external_mappings_tenant_id_status_idx" ON "integration_external_mappings"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_external_mappings_tenant_id_integration_account_key" ON "integration_external_mappings"("tenant_id", "integration_account_id", "external_type", "external_id");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_tenant_id_integration_account_id_crea_idx" ON "integration_sync_jobs"("tenant_id", "integration_account_id", "created_at");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_tenant_id_status_idx" ON "integration_sync_jobs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_status_next_retry_at_idx" ON "integration_sync_jobs"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_tenant_id_job_type_idx" ON "integration_sync_jobs"("tenant_id", "job_type");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_requested_by_id_idx" ON "integration_sync_jobs"("requested_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_sync_jobs_tenant_id_idempotency_key_key" ON "integration_sync_jobs"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "integration_health_events_tenant_id_status_severity_idx" ON "integration_health_events"("tenant_id", "status", "severity");

-- CreateIndex
CREATE INDEX "integration_health_events_tenant_id_integration_account_id__idx" ON "integration_health_events"("tenant_id", "integration_account_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "integration_health_events_provider_event_type_idx" ON "integration_health_events"("provider", "event_type");

-- AddForeignKey
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_connected_by_id_fkey" FOREIGN KEY ("connected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_disconnected_by_id_fkey" FOREIGN KEY ("disconnected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_integration_account_id_fkey" FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_external_mappings" ADD CONSTRAINT "integration_external_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_external_mappings" ADD CONSTRAINT "integration_external_mappings_integration_account_id_fkey" FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_integration_account_id_fkey" FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_health_events" ADD CONSTRAINT "integration_health_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_health_events" ADD CONSTRAINT "integration_health_events_integration_account_id_fkey" FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
