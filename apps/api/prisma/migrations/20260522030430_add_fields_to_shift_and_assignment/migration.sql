-- Drop old hard unique index, whichever name exists.
DROP INDEX IF EXISTS "shift_assignments_shift_id_employee_id_key";
DROP INDEX IF EXISTS "unique_employee_per_shift";

-- Add soft delete column.
ALTER TABLE "shift_assignments"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);

-- Create partial unique index for active assignments only.
CREATE UNIQUE INDEX IF NOT EXISTS "shift_assignments_active_unique"
ON "shift_assignments"("tenant_id", "shift_id", "employee_id")
WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "shift_assignments_tenant_id_shift_id_employee_id_idx"
ON "shift_assignments"("tenant_id", "shift_id", "employee_id");

CREATE INDEX IF NOT EXISTS "shift_assignments_tenant_id_status_idx"
ON "shift_assignments"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "shift_assignments_tenant_id_deleted_at_idx"
ON "shift_assignments"("tenant_id", "deleted_at");

CREATE INDEX IF NOT EXISTS "shifts_tenant_id_status_date_idx"
ON "shifts"("tenant_id", "status", "date");