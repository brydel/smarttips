-- CreateEnum
CREATE TYPE "employee_invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "employee_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "status" "employee_invitation_status" NOT NULL DEFAULT 'PENDING',
    "invited_by" UUID NOT NULL,
    "accepted_by" UUID,
    "accepted_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_invitations_token_hash_key" ON "employee_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "employee_invitations_tenant_id_idx" ON "employee_invitations"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_invitations_tenant_id_status_idx" ON "employee_invitations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "employee_invitations_tenant_id_employee_id_idx" ON "employee_invitations"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_invitations_tenant_id_employee_id_status_idx" ON "employee_invitations"("tenant_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_invitations_tenant_id_email_idx" ON "employee_invitations"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "employee_invitations_tenant_id_invited_by_idx" ON "employee_invitations"("tenant_id", "invited_by");

-- CreateIndex
CREATE INDEX "employee_invitations_expires_at_idx" ON "employee_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_closed_at_deleted_at_idx" ON "orders"("tenant_id", "status", "closed_at", "deleted_at");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_date_id_idx" ON "shifts"("tenant_id", "date", "id");

-- CreateIndex
CREATE INDEX "tip_distributions_tenant_id_created_at_deleted_at_idx" ON "tip_distributions"("tenant_id", "created_at", "deleted_at");

-- CreateIndex
CREATE INDEX "tip_distributions_tenant_id_employee_id_created_at_idx" ON "tip_distributions"("tenant_id", "employee_id", "created_at");

-- CreateIndex
CREATE INDEX "tip_pools_tenant_id_status_deleted_at_idx" ON "tip_pools"("tenant_id", "status", "deleted_at");

-- AddForeignKey
ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
