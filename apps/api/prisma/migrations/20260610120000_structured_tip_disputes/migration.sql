-- CreateEnum
CREATE TYPE "tip_dispute_status" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "tip_dispute_category" AS ENUM ('AMOUNT', 'HOURS', 'ROLE', 'OTHER');

-- CreateEnum
CREATE TYPE "tip_dispute_outcome" AS ENUM ('EXPLAINED', 'MANUAL_FOLLOW_UP');

-- AlterEnum
ALTER TYPE "action_item_type" ADD VALUE 'DISPUTE_OPEN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_action" ADD VALUE 'DISPUTE_OPENED';
ALTER TYPE "audit_action" ADD VALUE 'DISPUTE_REVIEW_STARTED';
ALTER TYPE "audit_action" ADD VALUE 'DISPUTE_RESOLVED';
ALTER TYPE "audit_action" ADD VALUE 'DISPUTE_WITHDRAWN';

-- CreateTable
CREATE TABLE "tip_disputes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "tip_distribution_id" UUID NOT NULL,
    "category" "tip_dispute_category" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" "tip_dispute_status" NOT NULL DEFAULT 'OPEN',
    "evidence_snapshot" JSONB NOT NULL,
    "outcome" "tip_dispute_outcome",
    "resolution_note" VARCHAR(1000),
    "review_started_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "withdrawn_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tip_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tip_disputes_tenant_id_idx" ON "tip_disputes"("tenant_id");

-- CreateIndex
CREATE INDEX "tip_disputes_tenant_id_status_created_at_idx" ON "tip_disputes"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "tip_disputes_tenant_id_employee_id_created_at_idx" ON "tip_disputes"("tenant_id", "employee_id", "created_at");

-- CreateIndex
CREATE INDEX "tip_disputes_tenant_id_tip_distribution_id_status_idx" ON "tip_disputes"("tenant_id", "tip_distribution_id", "status");

-- CreateIndex
CREATE INDEX "tip_disputes_tip_distribution_id_idx" ON "tip_disputes"("tip_distribution_id");

-- CreateIndex
CREATE INDEX "tip_disputes_employee_id_idx" ON "tip_disputes"("employee_id");

-- CreateIndex
CREATE INDEX "tip_disputes_reviewed_by_idx" ON "tip_disputes"("reviewed_by");

-- CreateIndex
CREATE INDEX "tip_disputes_resolved_by_idx" ON "tip_disputes"("resolved_by");

-- AddForeignKey
ALTER TABLE "tip_disputes" ADD CONSTRAINT "tip_disputes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_disputes" ADD CONSTRAINT "tip_disputes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_disputes" ADD CONSTRAINT "tip_disputes_tip_distribution_id_fkey" FOREIGN KEY ("tip_distribution_id") REFERENCES "tip_distributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_disputes" ADD CONSTRAINT "tip_disputes_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_disputes" ADD CONSTRAINT "tip_disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
