import { EmployeeRole, ComputationMethod } from '@prisma/client';
import { Prisma } from '@prisma/client';

export const SALES_ELIGIBLE_ROLES = new Set<EmployeeRole>([
  EmployeeRole.SERVER,
  EmployeeRole.BARTENDER,
]);

export const DEFAULT_ROLE_COEFFICIENTS: Record<EmployeeRole, Prisma.Decimal> = {
  [EmployeeRole.SERVER]: new Prisma.Decimal(1.0),
  [EmployeeRole.BARTENDER]: new Prisma.Decimal(0.9),
  [EmployeeRole.BUSSER]: new Prisma.Decimal(0.7),
  [EmployeeRole.HOST]: new Prisma.Decimal(0.6),
  [EmployeeRole.COOK]: new Prisma.Decimal(0.5),
  [EmployeeRole.CHEF]: new Prisma.Decimal(0.8),
};

export interface DistributionConfig {
  roleCoefficients: Record<EmployeeRole, Prisma.Decimal>;
  minimumPerHour: Prisma.Decimal;
  maxSharePercent: Prisma.Decimal;
  salesBonusWeight: Prisma.Decimal;
}

export interface EmployeeShiftInput {
  employeeId: string;
  role: EmployeeRole;
  hoursWorked: Prisma.Decimal;
  salesGenerated: Prisma.Decimal;
  coefficient: Prisma.Decimal;
}

export interface DistributionInput {
  tenantId: string;
  tipPoolId: string;
  shiftId: string;
  totalAmount: Prisma.Decimal;
  config: DistributionConfig;
  employees: EmployeeShiftInput[];
  computationMethod: ComputationMethod;
}

export interface DistributionExplanation {
  roleCoefficient: string;
  employeeCoefficient: string;
  hoursWorked: string;
  salesGenerated: string;
  shiftAvgSales: string;
  salesBonus: string;
  baseScore: string;
  rawScore: string;
  scoreShare: string;
  rawAmount: string;
  capAmount: string;
  minAmount: string;
  capApplied: boolean;
  minimumApplied: boolean;
  roundingAdjustmentCents: number;
  finalAmount: string;
}

export interface DistributionResult {
  employeeId: string;
  amount: Prisma.Decimal;
  contributionScore: Prisma.Decimal;
  explanation: DistributionExplanation;
}

export interface DistributionComputationResult {
  totalAmount: Prisma.Decimal;
  distributedAmount: Prisma.Decimal;
  remainderCents: number;
  results: DistributionResult[];
}
