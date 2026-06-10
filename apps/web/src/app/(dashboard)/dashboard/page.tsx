'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, RefreshCcw, X } from 'lucide-react';
import Link from 'next/link';
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
      style={{ background: 'var(--st-card)' }}
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
            background: value === o.value ? 'var(--st-border)' : 'transparent',
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
        <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--st-hi)' }}>
          Impossible de charger le tableau de bord
        </p>
        <p className="text-[12px]" style={{ color: 'var(--st-dim)' }}>
          Vérifiez votre connexion et réessayez.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium transition-colors hover:bg-st-raised border border-st-border"
        style={{ color: 'var(--st-hi)' }}
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
      className="flex items-center gap-3.5 px-4 sm:px-6 lg:px-8 py-3.5 border-b border-st-border shrink-0 sticky top-0 z-40"
      style={{ background: 'var(--st-glass-bg)', backdropFilter: 'blur(10px)' }}
    >
      <div className="flex items-center gap-1.5 text-[12.5px] min-w-0">
        <span className="truncate" style={{ color: 'var(--st-sec)' }}>
          {tenantName ?? '—'}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--st-dim)' }}
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="shrink-0" style={{ color: 'var(--st-hi)' }}>
          Vue d&apos;ensemble
        </span>
      </div>

      <div
        className="ml-auto hidden sm:flex items-center gap-1.5 text-[11.5px] font-mono"
        style={{ color: 'var(--st-dim)' }}
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

      <Link
        href="/dashboard/distributions"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-medium border border-st-border hover:bg-st-raised transition-colors shrink-0"
        style={{ color: 'var(--st-hi)', fontFamily: 'inherit' }}
      >
        <Plus size={12} />
        <span className="hidden sm:inline">Lancer distribution</span>
        <span className="sm:hidden">Distribuer</span>
      </Link>
    </header>
  );
}

// ── Onboarding ───────────────────────────────────────────────────────────────────

type DemoChecklistItem = {
  label: string;
  description: string;
  href: string;
  complete: boolean;
};

function DemoOnboardingChecklist({ items }: { items: DemoChecklistItem[] }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem('smarttips-demo-checklist-dismissed') === '1');
  }, []);

  if (dismissed) return null;

  const completed = items.filter((item) => item.complete).length;
  const progress = Math.round((completed / items.length) * 100);

  return (
    <section className="mb-5 rounded-lg border border-st-border bg-st-card p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-st-dim">
            Parcours de démo
          </p>
          <h2 className="mt-1 font-display text-[22px] leading-tight text-st-hi">
            Préparer une distribution complète.
          </h2>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-st-sec">
            Suivez le chemin manager: équipe, règles, shifts, calcul de distribution, puis exports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem('smarttips-demo-checklist-dismissed', '1');
            setDismissed(true);
          }}
          className="rounded-md p-1.5 text-st-dim transition-colors hover:bg-st-raised hover:text-st-hi"
          aria-label="Masquer le parcours de démo"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-st-border">
          <div
            className="h-full rounded-full bg-st-emerald transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-[11px] text-st-sec">
          {completed}/{items.length}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-md border border-st-border bg-st-raised/40 p-3 transition-colors hover:border-st-muted hover:bg-st-raised"
          >
            <div className="flex items-center gap-2">
              {item.complete ? (
                <CheckCircle2 size={14} className="text-st-emerald-glow" />
              ) : (
                <Circle size={14} className="text-st-dim" />
              )}
              <span className="text-[12.5px] font-medium text-st-hi">{item.label}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-st-sec">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
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
  const onboardingItems = useMemo<DemoChecklistItem[]>(() => {
    const hasTeamSignal = Boolean(data?.topEmployees?.length || data?.roleBreakdown?.length);
    const hasShiftSignal = Boolean(data?.liveShift || data?.tomorrowShifts?.length);
    const hasDistributionSignal = Boolean((data?.tipsTotal ?? 0) > 0);

    return [
      {
        label: 'Équipe',
        description: 'Inviter ou créer les employés qui participent aux shifts.',
        href: '/dashboard/employees',
        complete: hasTeamSignal,
      },
      {
        label: 'Règles',
        description: 'Vérifier les coefficients et garde-fous de distribution.',
        href: '/dashboard/settings/distribution',
        complete: false,
      },
      {
        label: 'Shifts',
        description: 'Créer ou revoir le service à distribuer.',
        href: '/dashboard/shifts',
        complete: hasShiftSignal,
      },
      {
        label: 'Distribution',
        description: 'Ouvrir les shifts clôturés et lancer le calcul.',
        href: '/dashboard/distributions',
        complete: hasDistributionSignal,
      },
      {
        label: 'Exports',
        description: 'Télécharger payroll, tip pool ou audit CSV.',
        href: '/dashboard/reports',
        complete: hasDistributionSignal,
      },
    ];
  }, [data]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar isFetching={isFetching} tenantName={user?.tenantName} />

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: 'var(--st-bg)', padding: '24px 32px 56px' }}
      >
        <DemoOnboardingChecklist items={onboardingItems} />

        {/* Page headline + period picker */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <p
              className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium mb-1.5"
              style={{ color: 'var(--st-sec)' }}
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
              style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--st-hi)' }}
            >
              {greeting}{' '}
              <em style={{ color: 'var(--st-sec)', fontStyle: 'italic' }}>
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
