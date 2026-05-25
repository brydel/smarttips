import { apiClient } from '../lib/api-client';
import type { DashboardStats, StatsPeriod } from '../types/dashboard';

const BASE = '/dashboard';

export async function fetchDashboardStats(
  period: StatsPeriod,
  signal?: AbortSignal,
): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>(`${BASE}/stats`, {
    params: { period },
    signal,
  });
  return data;
}
