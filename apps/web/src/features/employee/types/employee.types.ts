/**
 * Employee personal space types — BIS-23.
 *
 * These types are aligned with the planned backend API shape.
 * All amounts are strings (Prisma Decimal serialised to JSON) and must be
 * parsed with parseFloat() for arithmetic — never coerced with `as number`.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type TipPeriod = '7d' | '30d' | '90d' | 'all';

// ── Explanation (mirrors DistributionExplanation) ─────────────────────────────

export interface EmployeeShiftExplanation {
  roleCoefficient?: string;
  employeeCoefficient?: string;
  hoursWorked?: string;
  salesGenerated?: string;
  shiftAvgSales?: string;
  salesBonus?: string;
  baseScore?: string;
  rawScore?: string;
  scoreShare?: string;
  rawAmount?: string;
  capAmount?: string;
  minAmount?: string;
  capApplied?: boolean;
  minimumApplied?: boolean;
  roundingAdjustmentCents?: number;
  finalAmount?: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface EmployeeTrendPoint {
  date: string; // YYYY-MM-DD
  amount: number; // parsed Decimal
}

export interface EmployeeLastShift {
  shiftId: string;
  date: string;
  shiftType: string;
  role: string;
  hoursWorked: string | null;
  amount: string;
  computationMethod?: string;
  explanation?: EmployeeShiftExplanation | null;
}

export interface EmployeeDashboardSummary {
  weekTotal: string;
  monthTotal: string;
  monthShiftCount: number;
  averagePerShift: string;
  trend30Days: EmployeeTrendPoint[];
  lastShift: EmployeeLastShift | null;
}

// ── Shift history ─────────────────────────────────────────────────────────────

export interface EmployeeShiftRecord {
  id: string;
  shiftId: string;
  date: string;
  shiftType: string;
  role: string;
  hoursWorked: string | null;
  salesGenerated?: string | null;
  contributionScore?: string | null;
  amount: string;
  poolSharePct?: string | null;
  status?: string | null;
  paidAt?: string | null;
  acknowledgedAt?: string | null;
  explanation?: EmployeeShiftExplanation | null;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface EmployeeProfile {
  id: string;
  email: string;
  name: string;
  role: 'EMPLOYEE';
  tenantName?: string;
}

// ── Update payloads ───────────────────────────────────────────────────────────

/** PATCH /me — not yet implemented in backend. */
export interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  email: string;
}

/** PATCH /me/password — not yet implemented in backend. */
export interface UpdatePasswordPayload {
  currentPassword: string;
  newPassword: string;
}
