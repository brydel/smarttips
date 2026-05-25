'use client';

import { useState } from 'react';
import { Search, Bell, Plus, RefreshCcw } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useDashboardStats } from '../../../hooks/use-dashboard-stats';
import { useAuth } from '../../../hooks/use-auth';
import type { StatsPeriod } from '../../../types/dashboard';

// Components
import { TonightHero } from '../../../components/dashboard/overview/tonight-hero';
import {
  WeekKpi,
  FairnessKpi,
  ActionableKpi,
  InsightsCard,
} from '../../../components/dashboard/overview/dashboard-widgets';
import { DistributionChart } from '../../../components/dashboard/overview/distribution-chart';
import { RolesCard } from '../../../components/dashboard/overview/roles-card';
import { TopPerformersCard } from '../../../components/dashboard/overview/top-performers-card';
import { TomorrowStrip } from '../../../components/dashboard/overview/tomorrow-strip';
import {
  HeroSkeleton,
  KpiSkeleton,
  ChartSkeleton,
  CardSkeleton,
  TomorrowSkeleton,
} from '../../../components/dashboard/overview/dashboard-skeleton';

// ── Period picker ──────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: '30 jours' },
];

function PeriodPicker({
  value,
  onChange,
}: {
  value: StatsPeriod;
  onChange: (v: StatsPeriod) => void;
}) {
  return (
    <div
      className="flex gap-1 p-0.5 rounded-[10px] border border-st-border"
      style={{ background: 'var(--st-d-1)' }}
      role="group"
      aria-label="Période"
    >
      {PERIOD_OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'px-3 py-1.5 rounded-[8px] text-[11.5px] font-medium transition-colors cursor-pointer border border-transparent',
            value === o.value ? 'border-st-border text-st-hi' : 'text-st-sec hover:text-st-hi',
          )}
          style={{
            background: value === o.value ? 'var(--st-d-3)' : 'transparent',
            fontFamily: 'inherit',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Error state ────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center" role="alert">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,.1)' }}
      >
        <RefreshCcw size={20} style={{ color: 'var(--st-danger)' }} />
      </div>
      <div>
        <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--st-d-9)' }}>
          Impossible de charger le tableau de bord
        </p>
        <p className="text-[12px]" style={{ color: 'var(--st-d-6)' }}>
          Vérifiez votre connexion et réessayez.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium transition-colors hover:bg-st-raised border border-st-border"
        style={{ color: 'var(--st-d-9)' }}
      >
        <RefreshCcw size={13} />
        Réessayer
      </button>
    </div>
  );
}

// ── TopBar ─────────────────────────────────────────────────────────────────────

function TopBar({ isFetching, tenantName }: { isFetching: boolean; tenantName?: string }) {
  return (
    <header
      className="flex items-center gap-3.5 px-8 py-3.5 border-b border-st-border shrink-0 sticky top-0 z-40"
      style={{ background: 'rgba(10,14,26,.88)', backdropFilter: 'blur(10px)' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12.5px]">
        <span style={{ color: 'var(--st-d-7)' }}>{tenantName ?? '—'}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--st-d-6)' }}
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span style={{ color: 'var(--st-d-9)' }}>Vue d&apos;ensemble</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md ml-5 relative hidden sm:block">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--st-d-6)' }}
          aria-hidden="true"
        />
        <input
          placeholder="Rechercher employés, shifts, commandes…"
          aria-label="Rechercher"
          className="w-full pl-8 pr-12 py-2 rounded-[10px] border border-st-border text-[12.5px] bg-st-card text-st-hi placeholder:text-st-dim outline-none focus:border-st-muted transition-colors"
          style={{ fontFamily: 'inherit' }}
          readOnly
        />
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] border border-st-border px-1.5 py-0.5 rounded"
          style={{ color: 'var(--st-d-6)' }}
        >
          ⌘K
        </span>
      </div>

      {/* Live indicator */}
      <div
        className="ml-auto flex items-center gap-1.5 text-[11.5px] font-mono"
        style={{ color: 'var(--st-d-6)' }}
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            isFetching ? 'animate-pulse bg-st-indigo' : 'bg-st-emerald',
          )}
          aria-hidden="true"
        />
        {isFetching ? 'Mise à jour…' : 'API · OK'}
      </div>

      {/* Actions */}
      <button
        className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-medium border border-st-border hover:bg-st-raised transition-colors"
        style={{ color: 'var(--st-d-9)', fontFamily: 'inherit' }}
      >
        <Plus size={12} />
        Lancer distribution
      </button>
      <button
        className="relative p-2 rounded-md hover:bg-st-raised transition-colors"
        style={{ color: 'var(--st-d-7)', background: 'transparent', border: 0 }}
        aria-label="Notifications"
      >
        <Bell size={14} />
        <span
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--st-gold)' }}
          aria-hidden="true"
        />
      </button>
    </header>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

/** Time-based greeting matching the design: Bonjour / Bon après-midi / Bonsoir / Bonne nuit */
function getGreeting(firstName?: string): string {
  const h = new Date().getHours();
  const name = firstName ? ` ${firstName.split(' ')[0]}` : '';
  if (h >= 5 && h < 12) return `Bonjour${name}.`;
  if (h >= 12 && h < 18) return `Bon après-midi${name}.`;
  if (h >= 18 || h < 2) return `Bonsoir${name}.`;
  return `Bonne nuit${name}.`;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<StatsPeriod>('today');
  const { user } = useAuth();
  const { data, isLoading, isError, isFetching, refetch } = useDashboardStats(period);

  // Format tomorrow's date label
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLabel = tomorrow.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const greeting = getGreeting(user?.name);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar isFetching={isFetching} tenantName={user?.tenantName} />

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: 'var(--st-d-0)', padding: '24px 32px 56px' }}
      >
        {/* Page headline + period picker */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <p
              className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium mb-1.5"
              style={{ color: 'var(--st-d-7)' }}
            >
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {data?.liveShift ? (
                <span style={{ color: 'var(--st-indigo-glow)' }}> · service en cours</span>
              ) : null}
            </p>
            <h1
              className="text-[28px] sm:text-[34px] lg:text-[38px] leading-[1.05] tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--st-d-9)' }}
            >
              {greeting}{' '}
              <em style={{ color: 'var(--st-d-7)', fontStyle: 'italic' }}>
                {data?.liveShift && user?.tenantName
                  ? `Tout roule au ${user.tenantName}.`
                  : 'Bonne journée.'}
              </em>
            </h1>
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>

        {/* ── Error state ─────────────────────────────────────────────────── */}
        {isError && !isLoading && <ErrorState onRetry={refetch} />}

        {/* ── Loading state (skeletons) ────────────────────────────────────── */}
        {isLoading && (
          <>
            <HeroSkeleton />
            <div className="grid gap-3.5 mb-3.5" style={{ gridTemplateColumns: '1.1fr 1fr 1.4fr' }}>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </div>
            <div className="grid gap-3.5 mb-3.5" style={{ gridTemplateColumns: '1.45fr 1fr' }}>
              <ChartSkeleton />
              <CardSkeleton rows={2} />
            </div>
            <div className="grid gap-3.5 mb-3.5" style={{ gridTemplateColumns: '1.1fr 1.3fr' }}>
              <CardSkeleton rows={3} />
              <CardSkeleton rows={5} />
            </div>
            <TomorrowSkeleton />
          </>
        )}

        {/* ── Dashboard content ────────────────────────────────────────────── */}
        {!isLoading && data && (
          <>
            {/* Hero — live shift (only shown when a shift is in progress) */}
            {data.liveShift && <TonightHero shift={data.liveShift} />}

            {/* KPI strip — responsive 1→2→3 columns */}
            <style>{`
              @media (min-width: 640px)  { .kpi-grid     { grid-template-columns: 1fr 1fr !important; } }
              @media (min-width: 900px)  { .kpi-grid     { grid-template-columns: 1.1fr 1fr 1.4fr !important; } }
              @media (min-width: 900px)  { .chart-grid   { grid-template-columns: 1.45fr 1fr !important; } }
              @media (min-width: 900px)  { .insights-grid{ grid-template-columns: 1.1fr 1.3fr !important; } }
            `}</style>
            <div className="kpi-grid grid gap-3.5 mb-3.5" style={{ gridTemplateColumns: '1fr' }}>
              <WeekKpi
                total={data.tipsTotal}
                prevTotal={data.prevTipsTotal}
                dailyData={data.dailyTips.map((d) => d.total)}
              />
              <FairnessKpi value={data.fairnessScore} />
              <ActionableKpi alerts={data.alerts} />
            </div>

            {/* Chart + Roles — 1→2 columns */}
            <div className="chart-grid grid gap-3.5 mb-3.5" style={{ gridTemplateColumns: '1fr' }}>
              <DistributionChart dailyTips={data.dailyTips} />
              <RolesCard
                breakdown={data.roleBreakdown}
                liveTotal={data.liveShift?.liveOrdersTotal}
              />
            </div>

            {/* Insights + Top performers — 1→2 columns */}
            <div
              className="insights-grid grid gap-3.5 mb-3.5"
              style={{ gridTemplateColumns: '1fr' }}
            >
              <InsightsCard />
              <TopPerformersCard employees={data.topEmployees} />
            </div>

            {/* Tomorrow strip */}
            <TomorrowStrip shifts={data.tomorrowShifts} dateLabel={`Demain · ${tomorrowLabel}`} />
          </>
        )}
      </div>
    </div>
  );
}
