CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "employee_role" AS ENUM ('SERVER', 'BARTENDER', 'BUSSER', 'HOST', 'COOK', 'CHEF');

-- CreateEnum
CREATE TYPE "language" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "shift_type" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'LATE_NIGHT');

-- CreateEnum
CREATE TYPE "shift_status" AS ENUM ('PLANNED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('ASSIGNED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'CARD', 'MIXED');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('OPEN', 'SENT', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "tip_pool_status" AS ENUM ('DECLARED', 'DISTRIBUTED', 'FINALIZED', 'VOIDED');

-- CreateEnum
CREATE TYPE "distribution_mode" AS ENUM ('RULES_ONLY', 'ML_ASSISTED', 'ML_FULL');

-- CreateEnum
CREATE TYPE "computation_method" AS ENUM ('RULES', 'ML_ASSISTED', 'ML_FULL', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "ml_algorithm" AS ENUM ('LINEAR_REGRESSION', 'HOEFFDING_TREE', 'ENSEMBLE');

-- CreateEnum
CREATE TYPE "ml_model_status" AS ENUM ('TRAINING', 'ACTIVE', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "training_trigger" AS ENUM ('AUTO_AFTER_SHIFT', 'MANUAL_FEEDBACK', 'RETRAIN');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'VOID', 'RESTORE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "export_format" AS ENUM ('CSV', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "usage_metric_type" AS ENUM ('SHIFTS_PER_MONTH', 'EMPLOYEES_ACTIVE', 'ML_PREDICTIONS');

-- CreateEnum
CREATE TYPE "photo_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "address" JSONB,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Toronto',
    "currency" CHAR(3) NOT NULL DEFAULT 'CAD',
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.14975,
    "plan" "plan" NOT NULL DEFAULT 'FREE',
    "trial_ends_at" TIMESTAMPTZ(6),
    "stripe_customer_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "hashed_password" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "language" "language" NOT NULL DEFAULT 'FR',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "invited_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_number" VARCHAR(50),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" CITEXT,
    "phone" VARCHAR(50),
    "role" "employee_role" NOT NULL,
    "hire_date" DATE NOT NULL,
    "termination_date" DATE,
    "hourly_wage" DECIMAL(10,2) NOT NULL,
    "coefficient" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "approved_by_id" UUID,
    "status" "photo_status" NOT NULL DEFAULT 'PENDING',
    "original_url" VARCHAR(1000) NOT NULL,
    "display_url" VARCHAR(1000),
    "thumbnail_url" VARCHAR(1000),
    "mime_type" VARCHAR(100) NOT NULL,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "size_bytes" BIGINT,
    "sha256_hash" VARCHAR(64),
    "is_4k_ready" BOOLEAN NOT NULL DEFAULT false,
    "alt_text" VARCHAR(255),
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_role_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "previous_role" "employee_role" NOT NULL,
    "new_role" "employee_role" NOT NULL,
    "changed_by" UUID NOT NULL,
    "reason" TEXT,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_role_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "shift_type" "shift_type" NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "actual_end_time" TIMESTAMPTZ(6),
    "status" "shift_status" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "closed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "role_during_shift" "employee_role" NOT NULL,
    "scheduled_hours" DECIMAL(5,2) NOT NULL,
    "hours_worked" DECIMAL(5,2),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "check_in_at" TIMESTAMPTZ(6),
    "check_out_at" TIMESTAMPTZ(6),
    "status" "assignment_status" NOT NULL DEFAULT 'ASSIGNED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "table_number" VARCHAR(50) NOT NULL,
    "section" VARCHAR(100),
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "guest_count" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" "payment_method",
    "status" "order_status" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_pools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "cash_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "card_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "declared_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declared_by" UUID NOT NULL,
    "notes" TEXT,
    "status" "tip_pool_status" NOT NULL DEFAULT 'DECLARED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tip_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_distributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tip_pool_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "ml_model_id" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "contribution_score" DECIMAL(10,4) NOT NULL,
    "features_snapshot" JSONB,
    "explanation" JSONB NOT NULL,
    "computation_method" "computation_method" NOT NULL,
    "original_amount" DECIMAL(10,2),
    "adjusted_by" UUID,
    "adjustment_reason" TEXT,
    "acknowledged_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tip_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "mode" "distribution_mode" NOT NULL DEFAULT 'RULES_ONLY',
    "role_coefficients" JSONB NOT NULL,
    "min_per_hour" DECIMAL(10,2) NOT NULL DEFAULT 2.00,
    "max_share_pct" DECIMAL(5,2) NOT NULL DEFAULT 35.00,
    "sales_bonus_weight" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "tenure_bonus_enabled" BOOLEAN NOT NULL DEFAULT true,
    "fairness_audit_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cold_start_threshold" INTEGER NOT NULL DEFAULT 30,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "distribution_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "storage_url" VARCHAR(500) NOT NULL,
    "storage_size_bytes" BIGINT,
    "algorithm" "ml_algorithm" NOT NULL,
    "feature_schema" JSONB NOT NULL,
    "hyperparameters" JSONB,
    "training_samples_count" INTEGER NOT NULL DEFAULT 0,
    "metrics" JSONB,
    "drift_score" DECIMAL(5,4),
    "status" "ml_model_status" NOT NULL DEFAULT 'TRAINING',
    "activated_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_training_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ml_model_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "features" JSONB NOT NULL,
    "target_value" DECIMAL(10,4) NOT NULL,
    "prediction_before" DECIMAL(10,4),
    "loss" DECIMAL(10,6),
    "triggered_by" "training_trigger" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_training_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_predictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ml_model_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "features" JSONB NOT NULL,
    "predicted_score" DECIMAL(10,4) NOT NULL,
    "confidence_interval" JSONB,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fairness_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ml_model_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "audit_date" DATE NOT NULL,
    "demographic_parity_score" DECIMAL(5,4),
    "equal_opportunity_score" DECIMAL(5,4),
    "flagged_patterns" JSONB,
    "recommendations" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fairness_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "audit_action" NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "request_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "format" "export_format" NOT NULL,
    "storage_url" VARCHAR(500) NOT NULL,
    "generated_by" UUID NOT NULL,
    "downloaded_at" TIMESTAMPTZ(6),
    "signature_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "stripe_subscription_id" VARCHAR(255),
    "plan" "plan" NOT NULL,
    "status" "subscription_status" NOT NULL,
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "metric_type" "usage_metric_type" NOT NULL,
    "value" INTEGER NOT NULL,
    "period_month" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_stripe_customer_id_key" ON "tenants"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_plan_deleted_at_idx" ON "tenants"("plan", "deleted_at");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_role_idx" ON "users"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "users_tenant_id_deleted_at_idx" ON "users"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_tenant_id_idx" ON "refresh_tokens"("tenant_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_tenant_id_user_id_idx" ON "refresh_tokens"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_email_idx" ON "invitations"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_invited_by_idx" ON "invitations"("tenant_id", "invited_by");

-- CreateIndex
CREATE INDEX "invitations_token_hash_idx" ON "invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_tenant_id_idx" ON "employees"("tenant_id");

-- CreateIndex
CREATE INDEX "employees_tenant_id_role_idx" ON "employees"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "employees_tenant_id_active_deleted_at_idx" ON "employees"("tenant_id", "active", "deleted_at");

-- CreateIndex
CREATE INDEX "employees_user_id_idx" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenant_id_employee_number_key" ON "employees"("tenant_id", "employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_photos_employee_id_key" ON "employee_photos"("employee_id");

-- CreateIndex
CREATE INDEX "employee_photos_tenant_id_idx" ON "employee_photos"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_photos_tenant_id_status_idx" ON "employee_photos"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "employee_photos_tenant_id_is_4k_ready_idx" ON "employee_photos"("tenant_id", "is_4k_ready");

-- CreateIndex
CREATE INDEX "employee_photos_tenant_id_deleted_at_idx" ON "employee_photos"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "employee_photos_uploaded_by_id_idx" ON "employee_photos"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "employee_photos_approved_by_id_idx" ON "employee_photos"("approved_by_id");

-- CreateIndex
CREATE INDEX "employee_role_history_tenant_id_idx" ON "employee_role_history"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_role_history_tenant_id_employee_id_idx" ON "employee_role_history"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_role_history_employee_id_idx" ON "employee_role_history"("employee_id");

-- CreateIndex
CREATE INDEX "employee_role_history_employee_id_effective_date_idx" ON "employee_role_history"("employee_id", "effective_date");

-- CreateIndex
CREATE INDEX "menu_categories_tenant_id_display_order_idx" ON "menu_categories"("tenant_id", "display_order");

-- CreateIndex
CREATE INDEX "menu_categories_tenant_id_active_deleted_at_idx" ON "menu_categories"("tenant_id", "active", "deleted_at");

-- CreateIndex
CREATE INDEX "menu_items_tenant_id_idx" ON "menu_items"("tenant_id");

-- CreateIndex
CREATE INDEX "menu_items_tenant_id_category_id_idx" ON "menu_items"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "menu_items_tenant_id_active_deleted_at_idx" ON "menu_items"("tenant_id", "active", "deleted_at");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_idx" ON "shifts"("tenant_id");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_status_idx" ON "shifts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_date_idx" ON "shifts"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_deleted_at_idx" ON "shifts"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_tenant_id_date_shift_type_key" ON "shifts"("tenant_id", "date", "shift_type");

-- CreateIndex
CREATE INDEX "shift_assignments_tenant_id_idx" ON "shift_assignments"("tenant_id");

-- CreateIndex
CREATE INDEX "shift_assignments_tenant_id_shift_id_idx" ON "shift_assignments"("tenant_id", "shift_id");

-- CreateIndex
CREATE INDEX "shift_assignments_tenant_id_employee_id_idx" ON "shift_assignments"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "shift_assignments_shift_id_idx" ON "shift_assignments"("shift_id");

-- CreateIndex
CREATE INDEX "shift_assignments_employee_id_idx" ON "shift_assignments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_shift_id_employee_id_key" ON "shift_assignments"("shift_id", "employee_id");

-- CreateIndex
CREATE INDEX "restaurant_tables_tenant_id_section_idx" ON "restaurant_tables"("tenant_id", "section");

-- CreateIndex
CREATE INDEX "restaurant_tables_tenant_id_active_deleted_at_idx" ON "restaurant_tables"("tenant_id", "active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_tenant_id_table_number_key" ON "restaurant_tables"("tenant_id", "table_number");

-- CreateIndex
CREATE INDEX "orders_tenant_id_idx" ON "orders"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_idx" ON "orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "orders_tenant_id_deleted_at_idx" ON "orders"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "orders_shift_id_idx" ON "orders"("shift_id");

-- CreateIndex
CREATE INDEX "orders_shift_id_server_id_idx" ON "orders"("shift_id", "server_id");

-- CreateIndex
CREATE INDEX "orders_server_id_idx" ON "orders"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_order_number_key" ON "orders"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "order_items_tenant_id_idx" ON "order_items"("tenant_id");

-- CreateIndex
CREATE INDEX "order_items_tenant_id_order_id_idx" ON "order_items"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_menu_item_id_idx" ON "order_items"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "tip_pools_shift_id_key" ON "tip_pools"("shift_id");

-- CreateIndex
CREATE INDEX "tip_pools_tenant_id_idx" ON "tip_pools"("tenant_id");

-- CreateIndex
CREATE INDEX "tip_pools_tenant_id_status_idx" ON "tip_pools"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tip_pools_tenant_id_deleted_at_idx" ON "tip_pools"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "tip_distributions_tenant_id_idx" ON "tip_distributions"("tenant_id");

-- CreateIndex
CREATE INDEX "tip_distributions_tenant_id_tip_pool_id_idx" ON "tip_distributions"("tenant_id", "tip_pool_id");

-- CreateIndex
CREATE INDEX "tip_distributions_tenant_id_employee_id_idx" ON "tip_distributions"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "tip_distributions_tenant_id_deleted_at_idx" ON "tip_distributions"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "tip_distributions_tip_pool_id_idx" ON "tip_distributions"("tip_pool_id");

-- CreateIndex
CREATE INDEX "tip_distributions_employee_id_idx" ON "tip_distributions"("employee_id");

-- CreateIndex
CREATE INDEX "tip_distributions_employee_id_created_at_idx" ON "tip_distributions"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "tip_distributions_ml_model_id_idx" ON "tip_distributions"("ml_model_id");

-- CreateIndex
CREATE UNIQUE INDEX "tip_distributions_tip_pool_id_employee_id_key" ON "tip_distributions"("tip_pool_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "distribution_configs_tenant_id_key" ON "distribution_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "ml_models_tenant_id_idx" ON "ml_models"("tenant_id");

-- CreateIndex
CREATE INDEX "ml_models_tenant_id_status_idx" ON "ml_models"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ml_models_tenant_id_version_key" ON "ml_models"("tenant_id", "version");

-- CreateIndex
CREATE INDEX "ml_training_events_ml_model_id_idx" ON "ml_training_events"("ml_model_id");

-- CreateIndex
CREATE INDEX "ml_training_events_tenant_id_idx" ON "ml_training_events"("tenant_id");

-- CreateIndex
CREATE INDEX "ml_training_events_tenant_id_shift_id_idx" ON "ml_training_events"("tenant_id", "shift_id");

-- CreateIndex
CREATE INDEX "ml_training_events_ml_model_id_created_at_idx" ON "ml_training_events"("ml_model_id", "created_at");

-- CreateIndex
CREATE INDEX "ml_predictions_ml_model_id_idx" ON "ml_predictions"("ml_model_id");

-- CreateIndex
CREATE INDEX "ml_predictions_tenant_id_shift_id_idx" ON "ml_predictions"("tenant_id", "shift_id");

-- CreateIndex
CREATE INDEX "ml_predictions_tenant_id_employee_id_idx" ON "ml_predictions"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "ml_predictions_employee_id_idx" ON "ml_predictions"("employee_id");

-- CreateIndex
CREATE INDEX "fairness_audits_ml_model_id_idx" ON "fairness_audits"("ml_model_id");

-- CreateIndex
CREATE INDEX "fairness_audits_tenant_id_audit_date_idx" ON "fairness_audits"("tenant_id", "audit_date");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "payroll_exports_tenant_id_idx" ON "payroll_exports"("tenant_id");

-- CreateIndex
CREATE INDEX "payroll_exports_tenant_id_period_start_period_end_idx" ON "payroll_exports"("tenant_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "usage_metrics_tenant_id_idx" ON "usage_metrics"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_metrics_tenant_id_metric_type_period_month_key" ON "usage_metrics"("tenant_id", "metric_type", "period_month");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_photos" ADD CONSTRAINT "employee_photos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_photos" ADD CONSTRAINT "employee_photos_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_photos" ADD CONSTRAINT "employee_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_photos" ADD CONSTRAINT "employee_photos_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_role_history" ADD CONSTRAINT "employee_role_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_role_history" ADD CONSTRAINT "employee_role_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_role_history" ADD CONSTRAINT "employee_role_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_pools" ADD CONSTRAINT "tip_pools_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_pools" ADD CONSTRAINT "tip_pools_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_pools" ADD CONSTRAINT "tip_pools_declared_by_fkey" FOREIGN KEY ("declared_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_distributions" ADD CONSTRAINT "tip_distributions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_distributions" ADD CONSTRAINT "tip_distributions_tip_pool_id_fkey" FOREIGN KEY ("tip_pool_id") REFERENCES "tip_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_distributions" ADD CONSTRAINT "tip_distributions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_distributions" ADD CONSTRAINT "tip_distributions_ml_model_id_fkey" FOREIGN KEY ("ml_model_id") REFERENCES "ml_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_distributions" ADD CONSTRAINT "tip_distributions_adjusted_by_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_configs" ADD CONSTRAINT "distribution_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_configs" ADD CONSTRAINT "distribution_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_models" ADD CONSTRAINT "ml_models_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_training_events" ADD CONSTRAINT "ml_training_events_ml_model_id_fkey" FOREIGN KEY ("ml_model_id") REFERENCES "ml_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_training_events" ADD CONSTRAINT "ml_training_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_training_events" ADD CONSTRAINT "ml_training_events_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_ml_model_id_fkey" FOREIGN KEY ("ml_model_id") REFERENCES "ml_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fairness_audits" ADD CONSTRAINT "fairness_audits_ml_model_id_fkey" FOREIGN KEY ("ml_model_id") REFERENCES "ml_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fairness_audits" ADD CONSTRAINT "fairness_audits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fairness_audits" ADD CONSTRAINT "fairness_audits_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_exports" ADD CONSTRAINT "payroll_exports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_exports" ADD CONSTRAINT "payroll_exports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
