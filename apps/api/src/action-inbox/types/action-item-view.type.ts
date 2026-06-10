import { Prisma } from '@prisma/client';

/**
 * Shape exposée aux managers par l'API Action Inbox.
 * Le payload ne contient que des évidences minimales :
 * ids, dates, compteurs et libellés non sensibles.
 * Jamais de salaires, montants de pourboires ou données personnelles.
 */
export const actionItemViewSelect = {
  id: true,
  type: true,
  severity: true,
  status: true,
  title: true,
  entityType: true,
  entityId: true,
  shiftId: true,
  payload: true,
  resolutionNote: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ActionItemSelect;

export type ActionItemView = Prisma.ActionItemGetPayload<{
  select: typeof actionItemViewSelect;
}>;

export type ListActionItemsResult = {
  items: ActionItemView[];
  total: number;
  limit: number;
  offset: number;
};

export type RefreshActionInboxResult = {
  created: number;
  autoResolved: number;
  open: number;
};
