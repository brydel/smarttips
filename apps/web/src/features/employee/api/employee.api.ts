/**
 * Employee API — Personal space endpoints
 *
 * Portefeuille de pourboires (BIS-55) : implémenté.
 * - GET /employee/me/dashboard      → EmployeeDashboardSummary
 * - GET /employee/me/distributions  → EmployeeShiftRecord[] (?range=7d|30d|90d|all)
 * Les deux routes sont @Roles(EMPLOYEE) et strictement scopées à l'employé
 * authentifié côté backend (identité depuis le JWT, jamais d'employeeId client).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BACKEND ENDPOINTS NOT YET IMPLEMENTED                                    ║
 * ║                                                                          ║
 * ║  1. PATCH /me                                                             ║
 * ║     @Roles(ANY authenticated) — updates User.name / User.email           ║
 * ║     Body: { firstName: string; lastName: string; email: string }         ║
 * ║                                                                          ║
 * ║  2. PATCH /me/password                                                    ║
 * ║     @Roles(ANY authenticated) — changes hashed password                  ║
 * ║     Body: { currentPassword: string; newPassword: string }               ║
 * ║     Must verify currentPassword with bcrypt before saving.               ║
 * ║                                                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { apiClient } from '../../../lib/api-client';
import type {
  EmployeeDashboardSummary,
  EmployeeShiftRecord,
  TipPeriod,
  UpdateProfilePayload,
} from '../types/employee.types';
import type { AuthUser } from '../../../contexts/auth.context';

// ── Implemented: GET /auth/me ─────────────────────────────────────────────────
// Already available — the AuthContext hydrates this on load.
// Exposed here for explicit usage in profile hooks.
export async function getMyProfile(signal?: AbortSignal): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me', { signal });
  return data;
}

// ── Implemented: GET /employee/me/dashboard ───────────────────────────────────
/**
 * Returns the employee's tip summary (week/month totals, trend, last shift).
 * Backend scope: authenticated employee only, redacted explanations.
 */
export async function getMyDashboard(signal?: AbortSignal): Promise<EmployeeDashboardSummary> {
  const { data } = await apiClient.get<EmployeeDashboardSummary>('/employee/me/dashboard', {
    signal,
  });
  return data;
}

// ── Implemented: GET /employee/me/distributions ───────────────────────────────
/**
 * Returns the employee's personal tip distributions filtered by period.
 * Query string built explicitly (plain `range=30d` key, no brackets).
 */
export async function getMyDistributions(
  params?: { range?: TipPeriod },
  signal?: AbortSignal,
): Promise<EmployeeShiftRecord[]> {
  const search = new URLSearchParams();
  if (params?.range) search.set('range', params.range);

  const url = search.toString()
    ? `/employee/me/distributions?${search}`
    : '/employee/me/distributions';
  const { data } = await apiClient.get<EmployeeShiftRecord[]>(url, { signal });
  return data;
}

// ── Pending backend: PATCH /me ────────────────────────────────────────────────
/**
 * Updates the authenticated user's own profile (name, email).
 *
 * @throws {Error} with code 'ENDPOINT_NOT_IMPLEMENTED' until backend adds this route.
 */
export async function updateMyProfile(_payload: UpdateProfilePayload): Promise<AuthUser> {
  throw Object.assign(new Error('PATCH /me is not yet implemented in the backend.'), {
    code: 'ENDPOINT_NOT_IMPLEMENTED' as const,
  });
}

// ── Pending backend: PATCH /me/password ──────────────────────────────────────
/**
 * Changes the authenticated user's password.
 *
 * @throws {Error} with code 'ENDPOINT_NOT_IMPLEMENTED' until backend adds this route.
 */
export async function updateMyPassword(_payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  throw Object.assign(new Error('PATCH /me/password is not yet implemented in the backend.'), {
    code: 'ENDPOINT_NOT_IMPLEMENTED' as const,
  });
}
