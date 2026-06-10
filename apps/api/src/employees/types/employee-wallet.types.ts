import { ComputationMethod, EmployeeRole, ShiftType, TipPoolStatus } from '@prisma/client';

/**
 * Vues du portefeuille de pourboires employé (BIS-55).
 * Contrat aligné sur apps/web/src/features/employee/types/employee.types.ts.
 * Tous les montants sont des strings (Decimal sérialisé), jamais des numbers.
 */

/**
 * Explication redactée exposable à l'employé.
 * Liste blanche stricte : uniquement les intrants de SON calcul.
 * Exclus : source, schemaVersion, engineVersion, policyVersion,
 * modelVersion, mlWeight, mlShare, rulesShare, blendAlpha,
 * et toute donnée d'ajustement manager ou de collègue.
 */
export type EmployeeWalletExplanation = {
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
};

/** Statuts honnêtes exposés : pools calculés ou finalisés uniquement. */
export type EmployeeWalletStatus = Extract<TipPoolStatus, 'DISTRIBUTED' | 'FINALIZED'>;

export type EmployeeShiftRecordView = {
  id: string;
  shiftId: string;
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  role: EmployeeRole;
  hoursWorked: string | null;
  salesGenerated: string | null;
  contributionScore: string | null;
  amount: string;
  /** Fraction du pool (ex. "0.2533") — le front multiplie par 100. */
  poolSharePct: string | null;
  status: EmployeeWalletStatus;
  paidAt: string | null;
  acknowledgedAt: string | null;
  explanation: EmployeeWalletExplanation | null;
};

export type EmployeeTrendPointView = {
  date: string; // YYYY-MM-DD
  amount: number;
};

export type EmployeeLastShiftView = {
  shiftId: string;
  date: string;
  shiftType: ShiftType;
  role: EmployeeRole;
  hoursWorked: string | null;
  amount: string;
  computationMethod: ComputationMethod;
  explanation: EmployeeWalletExplanation | null;
};

export type EmployeeDashboardSummaryView = {
  weekTotal: string;
  monthTotal: string;
  monthShiftCount: number;
  averagePerShift: string;
  trend30Days: EmployeeTrendPointView[];
  lastShift: EmployeeLastShiftView | null;
};
