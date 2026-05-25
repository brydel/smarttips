import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { DASHBOARD_STATS_KEY } from '../lib/query-keys';
import { fetchDashboardStats } from '../services/dashboard.service';
import type { DashboardStats, StatsPeriod } from '../types/dashboard';

const LIVE_REFETCH_INTERVAL_MS = 30_000; // 30 s — keeps the dashboard "live"
const STALE_TIME_MS = 20_000;

/** Fail fast on auth/forbidden errors; max 1 retry with exponential backoff for everything else. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) return false; // never retry auth errors
  }
  return failureCount < 1; // at most one automatic retry
}

export function useDashboardStats(period: StatsPeriod): {
  data: DashboardStats | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
} {
  const { data, isLoading, isError, isFetching, refetch } = useQuery<DashboardStats>({
    queryKey: [DASHBOARD_STATS_KEY, period],
    queryFn: ({ signal }) => fetchDashboardStats(period, signal),
    staleTime: STALE_TIME_MS,
    // Stop polling automatically if the last fetch errored — avoids hammering a broken API
    refetchInterval: (query) => (query.state.status === 'error' ? false : LIVE_REFETCH_INTERVAL_MS),
    refetchIntervalInBackground: false, // pause when tab is not focused
    retry: shouldRetry,
    retryDelay: (attemptIndex) => Math.min(2_000 * 2 ** attemptIndex, 30_000),
  });

  return { data, isLoading, isError, isFetching, refetch };
}
