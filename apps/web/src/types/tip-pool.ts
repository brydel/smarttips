// ── Enums ─────────────────────────────────────────────────────────────────────
export const TIP_POOL_STATUSES = ['DECLARED', 'DISTRIBUTED', 'FINALIZED', 'VOIDED'] as const;
export type TipPoolStatus = (typeof TIP_POOL_STATUSES)[number];

// ── Main entity ───────────────────────────────────────────────────────────────
/** Full TipPool entity as returned by POST /tip-pools and GET /tip-pools/shift/:shiftId. */
export interface TipPool {
  id: string;
  tenantId: string;
  shiftId: string;
  /** Prisma Decimal → coerce with Number() */
  cashAmount: number;
  cardAmount: number;
  totalAmount: number;
  declaredAt: string;
  declaredBy: string;
  notes: string | null;
  status: TipPoolStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Payloads ──────────────────────────────────────────────────────────────────
/** POST /tip-pools body — mirrors CreateTipPoolDto exactly. */
export interface CreateTipPoolPayload {
  shiftId: string;
  cashAmount: number;
  cardAmount: number;
  notes?: string;
}
