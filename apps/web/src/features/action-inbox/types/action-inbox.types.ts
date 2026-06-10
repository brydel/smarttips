export type ActionItemType =
  | 'DISTRIBUTION_MISSING'
  | 'DISTRIBUTION_PENDING_APPROVAL'
  | 'SHIFT_CLOSE_OVERDUE'
  | 'SHIFT_UNASSIGNED'
  | 'DISPUTE_OPEN';

export type ActionItemSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type ActionItemStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface ActionItem {
  id: string;
  type: ActionItemType;
  severity: ActionItemSeverity;
  status: ActionItemStatus;
  title: string;
  entityType: string;
  entityId: string;
  shiftId: string | null;
  /** Évidence minimale : ids, dates, compteurs, libellés non sensibles. */
  payload: Record<string, unknown> | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionInboxList {
  items: ActionItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ActionInboxRefreshResult {
  created: number;
  autoResolved: number;
  open: number;
}

export interface ActionInboxFilters {
  status?: ActionItemStatus[];
  severity?: ActionItemSeverity[];
  type?: ActionItemType[];
  shiftId?: string;
}

export interface ActionInboxQuery extends ActionInboxFilters {
  limit?: number;
  offset?: number;
}

export interface UpdateActionItemStatusPayload {
  status: 'RESOLVED' | 'DISMISSED';
  note?: string;
}
