-- CreateEnum
CREATE TYPE "action_item_type" AS ENUM ('DISTRIBUTION_MISSING', 'DISTRIBUTION_PENDING_APPROVAL', 'SHIFT_CLOSE_OVERDUE', 'SHIFT_UNASSIGNED');

-- CreateEnum
CREATE TYPE "action_item_severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "action_item_status" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_action" ADD VALUE 'ACTION_ITEM_CREATED';
ALTER TYPE "audit_action" ADD VALUE 'ACTION_ITEM_RESOLVED';
ALTER TYPE "audit_action" ADD VALUE 'ACTION_ITEM_DISMISSED';

-- CreateTable
CREATE TABLE "action_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "action_item_type" NOT NULL,
    "severity" "action_item_severity" NOT NULL,
    "status" "action_item_status" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(200) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "shift_id" UUID,
    "payload" JSONB,
    "dedupe_key" VARCHAR(200) NOT NULL,
    "resolution_note" VARCHAR(500),
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_items_tenant_id_idx" ON "action_items"("tenant_id");

-- CreateIndex
CREATE INDEX "action_items_tenant_id_status_severity_idx" ON "action_items"("tenant_id", "status", "severity");

-- CreateIndex
CREATE INDEX "action_items_tenant_id_type_idx" ON "action_items"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "action_items_tenant_id_shift_id_idx" ON "action_items"("tenant_id", "shift_id");

-- CreateIndex
CREATE INDEX "action_items_tenant_id_status_created_at_idx" ON "action_items"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "action_items_shift_id_idx" ON "action_items"("shift_id");

-- CreateIndex
CREATE INDEX "action_items_resolved_by_idx" ON "action_items"("resolved_by");

-- CreateIndex
CREATE UNIQUE INDEX "action_items_tenant_id_dedupe_key_key" ON "action_items"("tenant_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
