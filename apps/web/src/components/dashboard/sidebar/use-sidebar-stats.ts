'use client';

import { useMemo } from 'react';
import { useDashboardStats } from '../../../hooks/use-dashboard-stats';
import type { DashboardStats, RoleBreakdown } from '../../../types/dashboard';

/**
 * Sidebar-derived KPIs.
 *
 * Reads the existing `/dashboard/stats?period=today` endpoint via the shared
 * React Query cache — when the user is on /dashboard the request is deduped,
 * elsewhere this single query powers every card. We never invent endpoints:
 * fields that the API doesn't expose yet (AI insights, integrations, ML model)
 * resolve to `null` so cards render a clean "—" fallback.
 */
export interface SidebarStats {
  /** Tip variation between current and previous period, e.g. "+18%" or "—". */
  tipsDeltaLabel: string;
  /** Distributions ready to declare (pools missing on closed shifts). */
  distributionsPending: number | null;
  /** Distribution KPI hint (e.g. "Aucune en attente"). */
  distributionsHint: string;
  /** Live shift progress (0–1) when a shift is currently running. */
  liveShiftProgress: number | null;
  /** Number of upcoming shifts (tomorrow). */
  tomorrowShiftsCount: number | null;
  /** Active employees, taken straight from the dashboard payload. */
  activeEmployees: number | null;
  /** Live shift team headcount (people on duty right now). */
  liveTeamCount: number | null;
  /** Role breakdown (max 4 rows) for the Catégories card. */
  roleBreakdown: RoleBreakdown[];
  /** Live shift label for the Shifts card subtitle ("En cours", "Aucun"). */
  shiftStatusLabel: string;
  /** True when the underlying query is loading for the first time. */
  isLoading: boolean;
  /** True when the underlying query errored — cards then show fallbacks only. */
  isError: boolean;
}

const EMPTY: SidebarStats = {
  tipsDeltaLabel: '—',
  distributionsPending: null,
  distributionsHint: 'Aucune donnée',
  liveShiftProgress: null,
  tomorrowShiftsCount: null,
  activeEmployees: null,
  liveTeamCount: null,
  roleBreakdown: [],
  shiftStatusLabel: '—',
  isLoading: true,
  isError: false,
};

function formatDelta(current: number, previous: number): string {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return '—';
  const delta = ((current - previous) / previous) * 100;
  if (!Number.isFinite(delta)) return '—';
  const rounded = Math.round(delta);
  if (rounded === 0) return '±0%';
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function deriveDistributionMetrics(stats: DashboardStats): {
  count: number | null;
  hint: string;
} {
  const pending = stats.alerts.filter((a) => a.type === 'NO_TIP_POOL').length;
  if (pending > 0) {
    return { count: pending, hint: pending === 1 ? 'À déclarer' : 'À déclarer' };
  }
  return { count: 0, hint: 'Aucune en attente' };
}

function deriveShiftLabel(stats: DashboardStats): string {
  if (stats.liveShift) return 'Service en cours';
  if (stats.tomorrowShifts.length > 0) return 'Planifiés demain';
  return 'Aucun à venir';
}

export function useSidebarStats(): SidebarStats {
  const { data, isLoading, isError } = useDashboardStats('today');

  return useMemo<SidebarStats>(() => {
    if (!data) return { ...EMPTY, isLoading, isError };

    const { count: distributionsPending, hint: distributionsHint } =
      deriveDistributionMetrics(data);

    return {
      tipsDeltaLabel: formatDelta(data.tipsTotal, data.prevTipsTotal),
      distributionsPending,
      distributionsHint,
      liveShiftProgress: data.liveShift ? data.liveShift.progressPct / 100 : null,
      tomorrowShiftsCount: data.tomorrowShifts.length,
      activeEmployees: data.activeEmployeesCount,
      liveTeamCount: data.liveShift?.teamCount ?? null,
      roleBreakdown: data.roleBreakdown.slice(0, 4),
      shiftStatusLabel: deriveShiftLabel(data),
      isLoading,
      isError,
    };
  }, [data, isLoading, isError]);
}
