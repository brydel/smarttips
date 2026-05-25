/**
 * Distribution feature types — aligned with backend DistributionService.getDistribution()
 * response shape. Amount fields are Prisma Decimal serialized as strings.
 */

export type DistributionRole = 'SERVER' | 'BARTENDER' | 'BUSSER' | 'HOST' | 'COOK' | 'CHEF';

/** Explanation fields produced by the distribution calculator. All string values
 *  are Prisma Decimal serialized to string — parse with parseFloat() for display only. */
export interface DistributionExplanation {
  roleCoefficient?: string; // e.g. "1.0000" — role-level multiplier
  employeeCoefficient?: string; // e.g. "1.0500" — employee-level multiplier
  hoursWorked?: string; // e.g. "6.5"
  salesGenerated?: string; // e.g. "1240.00"
  shiftAvgSales?: string; // e.g. "850.00" — avg sales of eligible roles
  salesBonus?: string; // e.g. "1.2300" — multiplicative bonus (1.0 = none)
  baseScore?: string; // e.g. "6.8250" = roleCoef × empCoef × hours
  rawScore?: string; // e.g. "8.3948" = baseScore × salesBonus
  scoreShare?: string; // e.g. "0.1561" = rawScore / totalTeamScore
  rawAmount?: string; // e.g. "713.80" = pool × scoreShare
  capAmount?: string; // e.g. "1603.95" — cap limit
  minAmount?: string; // e.g. "13.00" — minimum guaranteed
  capApplied?: boolean;
  minimumApplied?: boolean;
  roundingAdjustmentCents?: number;
  finalAmount?: string; // e.g. "713.81"
}

/** Features stored at computation time (immutable snapshot). */
export interface FeaturesSnapshot {
  role?: string;
  hoursWorked?: string;
  salesGenerated?: string;
  coefficient?: string;
}

export interface DistributionEmployee {
  id: string;
  firstName: string;
  lastName: string;
  role: DistributionRole;
}

/** One row in GET /shifts/:id/distribution response. */
export interface TipDistribution {
  id: string;
  employeeId: string;
  /** Prisma Decimal → string. Parse with parseFloat() for display only. */
  amount: string;
  /** Prisma Decimal → string. Parse with parseFloat() for display only. */
  contributionScore: string;
  featuresSnapshot: FeaturesSnapshot | null;
  explanation: DistributionExplanation;
  computationMethod: string;
  acknowledgedAt: string | null;
  paidAt: string | null;
  employee: DistributionEmployee;
}

/** Computed totals derived from the distributions array. */
export interface DistributionSummary {
  poolTotal: number;
  employeeCount: number;
  avgAmount: number;
  maxAmount: number;
  minAmount: number;
  totalScore: number;
  computationMethod: string;
}

/** Per-role aggregate used in the donut chart. */
export interface RoleAggregate {
  role: DistributionRole;
  label: string;
  color: string;
  amount: number;
  headcount: number;
  share: number; // 0..1
}
