import { apiClient } from '../../../lib/api-client';
import type {
  CreateDisputePayload,
  DisputeQueueQuery,
  DisputeQueueResult,
  EmployeeDispute,
  ManagerDispute,
  ResolveDisputePayload,
} from '../types/dispute.types';

const EMPLOYEE_BASE = '/employee/me/disputes';
const MANAGER_BASE = '/disputes';

// ── Employé ───────────────────────────────────────────────────────────────────

/**
 * POST /employee/me/disputes
 * Ouvre un litige sur une de SES distributions (identité depuis le JWT).
 * 409 si un litige actif existe déjà sur la distribution.
 */
export async function createDispute(payload: CreateDisputePayload): Promise<EmployeeDispute> {
  const { data } = await apiClient.post<EmployeeDispute>(EMPLOYEE_BASE, payload);
  return data;
}

/** GET /employee/me/disputes — litiges de l'employé authentifié uniquement. */
export async function getMyDisputes(signal?: AbortSignal): Promise<EmployeeDispute[]> {
  const { data } = await apiClient.get<EmployeeDispute[]>(EMPLOYEE_BASE, { signal });
  return data;
}

/**
 * PATCH /employee/me/disputes/:id/withdraw
 * Retrait possible uniquement tant que le litige est OPEN.
 */
export async function withdrawDispute(id: string): Promise<EmployeeDispute> {
  const { data } = await apiClient.patch<EmployeeDispute>(`${EMPLOYEE_BASE}/${id}/withdraw`);
  return data;
}

// ── Manager ───────────────────────────────────────────────────────────────────

/**
 * Sérialise les filtres en clés répétées SANS crochets
 * (`status=OPEN&status=IN_REVIEW`, jamais `status[]=OPEN`).
 */
function buildQueueParams(query: DisputeQueueQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const value of query.status ?? []) params.append('status', value);
  for (const value of query.category ?? []) params.append('category', value);

  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  return params;
}

/** GET /disputes — file tenant-scopée, OWNER/MANAGER (appliqué côté backend). */
export async function getDisputeQueue(
  query: DisputeQueueQuery,
  signal?: AbortSignal,
): Promise<DisputeQueueResult> {
  const params = buildQueueParams(query);
  const url = params.toString() ? `${MANAGER_BASE}?${params}` : MANAGER_BASE;
  const { data } = await apiClient.get<DisputeQueueResult>(url, { signal });
  return data;
}

/** PATCH /disputes/:id/review — « Prendre en charge » (OPEN → IN_REVIEW). */
export async function startDisputeReview(id: string): Promise<ManagerDispute> {
  const { data } = await apiClient.patch<ManagerDispute>(`${MANAGER_BASE}/${id}/review`);
  return data;
}

/**
 * PATCH /disputes/:id/resolve — résolution avec note obligatoire.
 * Aucune issue ne modifie un paiement.
 */
export async function resolveDispute(
  id: string,
  payload: ResolveDisputePayload,
): Promise<ManagerDispute> {
  const { data } = await apiClient.patch<ManagerDispute>(`${MANAGER_BASE}/${id}/resolve`, payload);
  return data;
}
