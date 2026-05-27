-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_action" ADD VALUE 'INVITATION_SENT';
ALTER TYPE "audit_action" ADD VALUE 'INVITATION_ACCEPTED';
ALTER TYPE "audit_action" ADD VALUE 'INVITATION_REVOKED';
ALTER TYPE "audit_action" ADD VALUE 'TIP_DISTRIBUTION_CREATED';
ALTER TYPE "audit_action" ADD VALUE 'TIP_DISTRIBUTION_ADJUSTED';
ALTER TYPE "audit_action" ADD VALUE 'TIP_DISTRIBUTION_MANUAL_ADJUSTED';
ALTER TYPE "audit_action" ADD VALUE 'TIP_DISTRIBUTION_APPROVED';
ALTER TYPE "audit_action" ADD VALUE 'DISTRIBUTION_CONFIG_UPDATED';
ALTER TYPE "audit_action" ADD VALUE 'EMPLOYEE_CREATED';
ALTER TYPE "audit_action" ADD VALUE 'EMPLOYEE_UPDATED';
ALTER TYPE "audit_action" ADD VALUE 'EMPLOYEE_DEACTIVATED';
ALTER TYPE "audit_action" ADD VALUE 'SHIFT_CLOSED';
ALTER TYPE "audit_action" ADD VALUE 'SHIFT_REOPENED';
ALTER TYPE "audit_action" ADD VALUE 'USER_LOGIN';
ALTER TYPE "audit_action" ADD VALUE 'USER_LOGOUT';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_action_idx" ON "audit_logs"("tenant_id", "action");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_user_id_idx" ON "audit_logs"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");
