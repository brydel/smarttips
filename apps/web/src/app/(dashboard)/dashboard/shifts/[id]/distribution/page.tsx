'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { isAxiosError } from 'axios';

import {
  useShiftDistribution,
  useDistributeShift,
} from '../../../../../../features/distribution/hooks/use-shift-distribution';
import { DistributionHeader } from '../../../../../../features/distribution/components/DistributionHeader';
import { DistributionKpiCards } from '../../../../../../features/distribution/components/DistributionKpiCards';
import { DistributionDonutChart } from '../../../../../../features/distribution/components/DistributionDonutChart';
import { DistributionTable } from '../../../../../../features/distribution/components/DistributionTable';
import { DistributionActions } from '../../../../../../features/distribution/components/DistributionActions';
import {
  computeSummary,
  computeRoleAggregates,
} from '../../../../../../features/distribution/utils/distribution-calculations';
import { Button } from '../../../../../../components/ui/button';
import { useAuth } from '../../../../../../hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { fetchShift } from '../../../../../../services/shifts.service';
import { SHIFT_KEY } from '../../../../../../lib/query-keys';

export default function ShiftDistributionPage() {
  const params = useParams<{ id: string }>();
  const shiftId = params.id;

  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  // Fetch shift info in parallel (for header metadata)
  const shiftQuery = useQuery({
    queryKey: [SHIFT_KEY, shiftId],
    queryFn: ({ signal }) => fetchShift(shiftId, signal),
    enabled: !!shiftId,
    staleTime: 60_000,
    retry: false,
  });

  // Fetch distribution data
  const { data: distributions, isLoading, isError, error, refetch } = useShiftDistribution(shiftId);

  // Distribution trigger mutation
  const distributeMutation = useDistributeShift(shiftId);

  // Derived data
  const summary = useMemo(
    () => (distributions ? computeSummary(distributions) : null),
    [distributions],
  );

  const roleAggregates = useMemo(
    () => (distributions && summary ? computeRoleAggregates(distributions, summary.poolTotal) : []),
    [distributions, summary],
  );

  const totalScore = summary?.totalScore ?? 0;
  const poolTotal = summary?.poolTotal ?? 0;

  // Toggle expand (one at a time)
  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ── Determine error type ──────────────────────────────────────────────
  const is404 = isAxiosError(error) && error.response?.status === 404;
  const is403 = isAxiosError(error) && error.response?.status === 403;

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <DistributionHeader shift={shiftQuery.data ?? null} summary={null} shiftId={shiftId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-st-sec">
            <svg
              className="animate-spin text-st-indigo"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span className="text-[13px]">Chargement de la répartition…</span>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Forbidden ────────────────────────────────────────────────────────
  if (is403) {
    return (
      <PageShell>
        <DistributionHeader shift={shiftQuery.data ?? null} summary={null} shiftId={shiftId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center flex flex-col items-center gap-4 max-w-sm">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,.12)' }}
            >
              <AlertCircle size={20} className="text-st-danger" />
            </div>
            <div>
              <p className="text-[15px] font-medium text-st-hi mb-1.5">Accès refusé</p>
              <p className="text-[13px] text-st-sec">
                Vous n&apos;avez pas accès à cette répartition.
              </p>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Not distributed yet (404) ─────────────────────────────────────────
  if (is404) {
    const canDistribute = user?.role === 'OWNER' || user?.role === 'MANAGER';

    return (
      <PageShell>
        <DistributionHeader shift={shiftQuery.data ?? null} summary={null} shiftId={shiftId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center flex flex-col items-center gap-5 max-w-sm">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,.1)' }}
            >
              <Zap size={22} className="text-st-indigo-glow" />
            </div>
            <div>
              <p className="text-[15px] font-medium text-st-hi mb-2">Aucune distribution générée</p>
              <p className="text-[13px] text-st-sec leading-relaxed">
                {canDistribute
                  ? 'Le shift doit être clôturé et un tip pool déclaré avant de lancer le calcul.'
                  : 'Demandez à un gestionnaire de générer la distribution.'}
              </p>
            </div>
            {canDistribute && (
              <Button
                onClick={() => distributeMutation.mutate()}
                loading={distributeMutation.isPending}
                className="flex items-center gap-2"
              >
                <Zap size={14} />
                Générer la distribution
              </Button>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Generic error ─────────────────────────────────────────────────────
  if (isError) {
    return (
      <PageShell>
        <DistributionHeader shift={shiftQuery.data ?? null} summary={null} shiftId={shiftId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center flex flex-col items-center gap-4 max-w-sm">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,.10)' }}
            >
              <AlertCircle size={20} className="text-st-danger" />
            </div>
            <div>
              <p className="text-[15px] font-medium text-st-hi mb-1.5">
                Impossible de charger la répartition
              </p>
              <p className="text-[13px] text-st-sec">
                Une erreur est survenue. Vérifiez votre connexion et réessayez.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refetch()}
              className="flex items-center gap-2"
            >
              <RefreshCw size={13} />
              Réessayer
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Empty (no distributions, no error) ──────────────────────────────
  if (!distributions || distributions.length === 0) {
    return (
      <PageShell>
        <DistributionHeader shift={shiftQuery.data ?? null} summary={null} shiftId={shiftId} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-[15px] font-medium text-st-hi mb-2">Distribution vide</p>
            <p className="text-[13px] text-st-sec">Aucun employé trouvé dans cette distribution.</p>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <PageShell>
      {/* Sticky header */}
      <DistributionHeader shift={shiftQuery.data ?? null} summary={summary} shiftId={shiftId} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 flex flex-col gap-5 sm:gap-6 max-w-[1400px] mx-auto">
          {/* KPI strip */}
          {summary && <DistributionKpiCards summary={summary} />}

          {/* Hero flow card */}
          <div
            className="rounded-lg p-5 sm:p-6 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #0F1422, color-mix(in srgb, #D4A574 6%, #0F1422))',
              border: '1px solid #252D45',
            }}
          >
            {/* Radial glow */}
            <div
              className="absolute pointer-events-none"
              style={{
                inset: '-20% -20%',
                background:
                  'radial-gradient(800px 240px at 50% 0%, rgba(212,165,116,.08), transparent 60%)',
              }}
            />

            <div className="relative flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim mb-1">
                    Pool de pourboires
                  </p>
                  <p className="font-display text-2xl sm:text-3xl text-st-hi leading-tight">
                    Répartition{' '}
                    <em className="italic" style={{ color: '#8892B0' }}>
                      de ce shift.
                    </em>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-3xl sm:text-4xl text-st-gold-glow font-medium leading-none">
                    ${poolTotal.toFixed(2)}
                  </p>
                  <p className="text-[11px] font-mono text-st-dim mt-1">
                    {distributions.length} employés · {summary?.computationMethod}
                  </p>
                </div>
              </div>

              {/* Stacked bar */}
              <div
                className="h-3.5 rounded-pill overflow-hidden flex"
                style={{ background: '#1B2236' }}
              >
                {roleAggregates.map((agg) => (
                  <div
                    key={agg.role}
                    className="h-full transition-all"
                    style={{
                      width: `${agg.share * 100}%`,
                      background: agg.color,
                      minWidth: agg.share > 0.01 ? 2 : 0,
                    }}
                    title={`${agg.label}: $${agg.amount.toFixed(2)}`}
                  />
                ))}
              </div>

              {/* Role legend inline */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {roleAggregates.map((agg) => (
                  <span
                    key={agg.role}
                    className="flex items-center gap-1.5 text-[11px] text-st-sec"
                  >
                    <span
                      className="w-2 h-2 rounded-[2px] shrink-0"
                      style={{ background: agg.color }}
                    />
                    {agg.label}{' '}
                    <span className="font-mono text-st-dim">{(agg.share * 100).toFixed(1)}%</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Donut + Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 sm:gap-6">
            {/* Donut chart card */}
            <div className="bg-st-card border border-st-border rounded-lg p-5 sm:p-6 flex flex-col items-center gap-4">
              <p className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim self-start w-full">
                Répartition par rôle
              </p>
              <DistributionDonutChart
                aggregates={roleAggregates}
                poolTotal={poolTotal}
                hoveredRole={hoveredRole}
                onHoverRole={setHoveredRole}
              />
            </div>

            {/* Actions card */}
            <div className="flex flex-col gap-4 justify-start">
              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <MicroStat
                  label="Pool distribué"
                  value={`$${poolTotal.toFixed(0)}`}
                  sub={`${distributions.length} bénéficiaires`}
                  accent="emerald"
                />
                <MicroStat
                  label="Score total"
                  value={totalScore.toFixed(2)}
                  sub="points équipe"
                  accent="indigo"
                />
                <MicroStat
                  label="Moy. / personne"
                  value={`$${(summary?.avgAmount ?? 0).toFixed(2)}`}
                  sub="par tête"
                />
                <MicroStat
                  label="Écart max–min"
                  value={`$${((summary?.maxAmount ?? 0) - (summary?.minAmount ?? 0)).toFixed(2)}`}
                  sub="dispersion"
                />
              </div>

              {/* Actions */}
              {user && <DistributionActions userRole={user.role} />}

              {/* Audit placeholder */}
              <div className="bg-st-card border border-st-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-st-border">
                  <p className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim">
                    Historique des ajustements
                  </p>
                  <p className="text-[13px] text-st-hi mt-0.5">Audit trail</p>
                </div>
                <div className="px-4 py-4 text-center text-[12.5px] text-st-dim italic">
                  Aucun ajustement manuel sur ce shift.
                </div>
              </div>
            </div>
          </div>

          {/* Table section header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <p className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim mb-1">
                Détail par employé
              </p>
              <h2 className="font-display text-2xl sm:text-[28px] text-st-hi leading-tight">
                Distribution{' '}
                <em className="italic" style={{ color: '#8892B0' }}>
                  ligne par ligne.
                </em>
              </h2>
            </div>
            <p className="text-[11.5px] text-st-dim hidden sm:block">
              Cliquez une ligne pour voir le calcul complet
            </p>
          </div>

          {/* Distribution table */}
          <DistributionTable
            distributions={distributions}
            totalScore={totalScore}
            poolTotal={poolTotal}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
            hoveredRole={hoveredRole}
            onHoverRole={setHoveredRole}
          />

          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </div>
    </PageShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col h-full overflow-hidden bg-st-bg min-w-0">{children}</div>;
}

interface MicroStatProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'gold' | 'emerald' | 'indigo';
}

function MicroStat({ label, value, sub, accent }: MicroStatProps) {
  const valueColor = accent
    ? { gold: 'text-st-gold-glow', emerald: 'text-st-emerald-glow', indigo: 'text-st-indigo-glow' }[
        accent
      ]
    : 'text-st-hi';

  return (
    <div className="bg-st-card border border-st-border rounded-lg p-3 flex flex-col gap-1 min-w-0">
      <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-st-dim truncate">
        {label}
      </p>
      <p className={`font-mono text-[15px] font-medium leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10.5px] font-mono text-st-dim truncate">{sub}</p>}
    </div>
  );
}
