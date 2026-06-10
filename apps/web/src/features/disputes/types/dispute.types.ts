import type { EmployeeShiftExplanation } from '../../employee/types/employee.types';

/**
 * Litiges structurés de pourboires (BIS-56).
 * Un litige ne modifie JAMAIS un montant : les issues sont documentaires.
 */

export type TipDisputeStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'WITHDRAWN';

export type TipDisputeCategory = 'AMOUNT' | 'HOURS' | 'ROLE' | 'OTHER';

export type TipDisputeOutcome = 'EXPLAINED' | 'MANUAL_FOLLOW_UP';

/**
 * Snapshot d'évidence immuable capturé à l'ouverture du litige.
 * Données de l'employé concerné uniquement, explication redactée (BIS-55).
 */
export interface DisputeEvidenceSnapshot {
  snapshotVersion: number;
  capturedAt: string;
  tipDistributionId: string;
  shiftId: string;
  shiftDate: string; // YYYY-MM-DD
  shiftType: string;
  amount: string;
  contributionScore: string;
  computationMethod: string;
  poolStatus: string;
  roleDuringShift: string | null;
  hoursWorked: string | null;
  explanation: EmployeeShiftExplanation | null;
}

export interface EmployeeDispute {
  id: string;
  tipDistributionId: string;
  category: TipDisputeCategory;
  message: string;
  status: TipDisputeStatus;
  outcome: TipDisputeOutcome | null;
  /** Réponse du gestionnaire, visible par l'employé une fois résolue. */
  resolutionNote: string | null;
  evidenceSnapshot: DisputeEvidenceSnapshot;
  reviewStartedAt: string | null;
  resolvedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerDispute extends EmployeeDispute {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface DisputeQueueResult {
  items: ManagerDispute[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateDisputePayload {
  tipDistributionId: string;
  category: TipDisputeCategory;
  message: string;
}

export interface ResolveDisputePayload {
  outcome: TipDisputeOutcome;
  resolutionNote: string;
}

export interface DisputeQueueFilters {
  status?: TipDisputeStatus[];
  category?: TipDisputeCategory[];
}

export interface DisputeQueueQuery extends DisputeQueueFilters {
  limit?: number;
  offset?: number;
}
