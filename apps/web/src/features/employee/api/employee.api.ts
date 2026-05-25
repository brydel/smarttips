/**
 * Employee API — Personal space endpoints (BIS-23)
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BACKEND ENDPOINTS NOT YET IMPLEMENTED                                  ║
 * ║                                                                          ║
 * ║  The following NestJS routes need to be added in the API:               ║
 * ║                                                                          ║
 * ║  1. GET  /employee/me/dashboard                                          ║
 * ║     @Roles(EMPLOYEE) — returns EmployeeDashboardSummary                  ║
 * ║     Filtered by req.user.id → linked Employee → aggregated tips          ║
 * ║                                                                          ║
 * ║  2. GET  /employee/me/distributions                                      ║
 * ║     @Roles(EMPLOYEE) — returns EmployeeShiftRecord[]                     ║
 * ║     Queries TipDistribution WHERE employee.userId = req.user.id          ║
 * ║     Supports ?range=7d|30d|90d|all query param                           ║
 * ║                                                                          ║
 * ║  3. PATCH /me                                                            ║
 * ║     @Roles(ANY authenticated) — updates User.name / User.email           ║
 * ║     Body: { firstName: string; lastName: string; email: string }         ║
 * ║                                                                          ║
 * ║  4. PATCH /me/password                                                   ║
 * ║     @Roles(ANY authenticated) — changes hashed password                  ║
 * ║     Body: { currentPassword: string; newPassword: string }               ║
 * ║     Must verify currentPassword with bcrypt before saving.               ║
 * ║                                                                          ║
 * ║  Security notes:                                                         ║
 * ║  - All queries MUST use req.user.id / req.user.tenantId from JWT         ║
 * ║  - Never accept employeeId in the request body or query params           ║
 * ║  - Use employee.userId = req.user.id to find the employee record         ║
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

// ── Pending backend: GET /employee/me/dashboard ───────────────────────────────
/**
 * Returns the employee's tip summary (week/month totals, trend, last shift).
 *
 * @throws {Error} with code 'ENDPOINT_NOT_IMPLEMENTED' until backend adds this route.
 */
export async function getMyDashboard(_signal?: AbortSignal): Promise<EmployeeDashboardSummary> {
  throw Object.assign(
    new Error('GET /employee/me/dashboard is not yet implemented in the backend.'),
    { code: 'ENDPOINT_NOT_IMPLEMENTED' as const },
  );
}

// ── Pending backend: GET /employee/me/distributions ──────────────────────────
/**
 * Returns the employee's personal tip distributions filtered by period.
 *
 * @throws {Error} with code 'ENDPOINT_NOT_IMPLEMENTED' until backend adds this route.
 */
export async function getMyDistributions(
  _params?: { range?: TipPeriod },
  _signal?: AbortSignal,
): Promise<EmployeeShiftRecord[]> {
  throw Object.assign(
    new Error('GET /employee/me/distributions is not yet implemented in the backend.'),
    { code: 'ENDPOINT_NOT_IMPLEMENTED' as const },
  );
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
