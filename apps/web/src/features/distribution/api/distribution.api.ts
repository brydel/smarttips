import { apiClient } from '../../../lib/api-client';
import type { TipDistribution } from '../types/distribution.types';

const BASE = '/shifts';

/**
 * GET /shifts/:id/distribution
 * Returns the tip distributions for the given shift, ordered by amount desc.
 * Requires OWNER or MANAGER role (enforced by backend).
 */
export async function getShiftDistribution(
  shiftId: string,
  signal?: AbortSignal,
): Promise<TipDistribution[]> {
  const { data } = await apiClient.get<TipDistribution[]>(`${BASE}/${shiftId}/distribution`, {
    signal,
  });
  return data;
}

/**
 * POST /shifts/:id/distribute
 * Triggers the distribution calculation for a CLOSED shift.
 * Requires OWNER or MANAGER role (enforced by backend).
 * Returns 204 No Content on success.
 */
export async function distributeShift(shiftId: string): Promise<void> {
  await apiClient.post(`${BASE}/${shiftId}/distribute`);
}

/*
 * NOTE: The following endpoints do NOT exist in the current backend:
 *   - POST /shifts/:id/distribution/approve   → "Approuver la distribution"
 *   - PATCH /tip-distributions/:id/adjust     → "Ajustement manuel"
 *
 * These actions are therefore displayed as disabled in the UI.
 * When the backend implements them, add the service functions here:
 *
 *   export async function approveDistribution(shiftId: string): Promise<void> {
 *     await apiClient.post(`${BASE}/${shiftId}/distribution/approve`);
 *   }
 *
 *   export async function adjustDistribution(
 *     distributionId: string,
 *     payload: { amount: number; reason: string },
 *   ): Promise<TipDistribution> {
 *     const { data } = await apiClient.patch<TipDistribution>(
 *       `/tip-distributions/${distributionId}/adjust`,
 *       payload,
 *     );
 *     return data;
 *   }
 */
