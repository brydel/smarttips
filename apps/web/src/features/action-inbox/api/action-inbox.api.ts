import { apiClient } from '../../../lib/api-client';
import type {
  ActionInboxList,
  ActionInboxQuery,
  ActionInboxRefreshResult,
  ActionItem,
  UpdateActionItemStatusPayload,
} from '../types/action-inbox.types';

const BASE = '/action-inbox';

/**
 * Sérialise les filtres en clés répétées SANS crochets
 * (`status=OPEN&status=RESOLVED`, jamais `status[]=OPEN`).
 * Le parseur de requêtes du backend traite `status[]` comme une clé
 * inconnue et la validation whitelist répond 400.
 * Les valeurs absentes ou vides ne sont pas envoyées.
 */
function buildActionInboxParams(query: ActionInboxQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const value of query.status ?? []) params.append('status', value);
  for (const value of query.severity ?? []) params.append('severity', value);
  for (const value of query.type ?? []) params.append('type', value);

  if (query.shiftId) params.set('shiftId', query.shiftId);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  return params;
}

/**
 * GET /action-inbox
 * Liste tenant-scopée des actions manager, triée par sévérité puis récence.
 * Requiert OWNER ou MANAGER (appliqué côté backend).
 */
export async function getActionInbox(
  query: ActionInboxQuery,
  signal?: AbortSignal,
): Promise<ActionInboxList> {
  const params = buildActionInboxParams(query);
  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const { data } = await apiClient.get<ActionInboxList>(url, { signal });
  return data;
}

/**
 * POST /action-inbox/refresh
 * Exécute les détecteurs à base de règles sur les données réelles du tenant.
 * Idempotent : pas de doublons, les items ignorés ne sont jamais réouverts.
 */
export async function refreshActionInbox(): Promise<ActionInboxRefreshResult> {
  const { data } = await apiClient.post<ActionInboxRefreshResult>(`${BASE}/refresh`);
  return data;
}

/**
 * PATCH /action-inbox/:id/status
 * Transition manuelle OPEN → RESOLVED | DISMISSED avec note optionnelle.
 */
export async function updateActionItemStatus(
  id: string,
  payload: UpdateActionItemStatusPayload,
): Promise<ActionItem> {
  const { data } = await apiClient.patch<ActionItem>(`${BASE}/${id}/status`, payload);
  return data;
}
