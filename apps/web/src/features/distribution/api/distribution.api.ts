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

export async function downloadTipPoolReportPdf(shiftId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/reports/tip-pool', {
    params: { shiftId },
    responseType: 'blob',
  });
  return data;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
