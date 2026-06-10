import { ComputationMethod, EmployeeRole, Prisma, ShiftType, TipPoolStatus } from '@prisma/client';

import { EmployeeWalletExplanation } from '../../employees/types/employee-wallet.types';

/**
 * Snapshot d'évidence immuable capturé à l'ouverture du litige (BIS-56).
 * Contenu strictement limité aux données de l'employé concerné :
 * - explication redactée par la même liste blanche que le portefeuille (BIS-55) ;
 * - ses propres heures et rôle pendant le shift ;
 * - jamais de données de collègues, jamais d'internals moteur/ML.
 */
export type DisputeEvidenceSnapshot = {
  snapshotVersion: 1;
  capturedAt: string;
  tipDistributionId: string;
  shiftId: string;
  shiftDate: string; // YYYY-MM-DD
  shiftType: ShiftType;
  amount: string;
  contributionScore: string;
  computationMethod: ComputationMethod;
  poolStatus: TipPoolStatus;
  roleDuringShift: EmployeeRole | null;
  hoursWorked: string | null;
  explanation: EmployeeWalletExplanation | null;
};

/**
 * Shape exposée à l'employé : son litige, le statut et la réponse du manager.
 * Pas d'identité du réviseur (reviewedById/resolvedById restent internes).
 */
export const employeeDisputeViewSelect = {
  id: true,
  tipDistributionId: true,
  category: true,
  message: true,
  status: true,
  outcome: true,
  resolutionNote: true,
  evidenceSnapshot: true,
  reviewStartedAt: true,
  resolvedAt: true,
  withdrawnAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TipDisputeSelect;

export type EmployeeDisputeView = Prisma.TipDisputeGetPayload<{
  select: typeof employeeDisputeViewSelect;
}>;

/**
 * Shape exposée aux managers : litige complet + identité de l'employé.
 * L'évidence reste le snapshot redacté capturé à la création.
 */
export const managerDisputeViewSelect = {
  id: true,
  tipDistributionId: true,
  category: true,
  message: true,
  status: true,
  outcome: true,
  resolutionNote: true,
  evidenceSnapshot: true,
  reviewStartedAt: true,
  resolvedAt: true,
  withdrawnAt: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
} satisfies Prisma.TipDisputeSelect;

export type ManagerDisputeView = Prisma.TipDisputeGetPayload<{
  select: typeof managerDisputeViewSelect;
}>;

export type ListDisputesResult = {
  items: ManagerDisputeView[];
  total: number;
  limit: number;
  offset: number;
};
