'use client';

import { useMemo, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import type { DistributionConfig, RoleName } from '../types/tenant-config.types';
import { ROLE_META, SIM_HEADCOUNT } from '../types/tenant-config.types';
import { cn } from '../../../lib/cn';

// ── Simulation engine (deterministic, client-side only) ───────────────────

type RoleSimData = { headcount: number; perPerson: number; total: number; share: number };
type SimResult = {
  byRole: Partial<Record<RoleName, RoleSimData>>;
  totalDistributed: number;
  overflow: number;
  cappedCount: number;
  min: number;
  max: number;
  avg: number;
};

function simulate(config: DistributionConfig, pool: number): SimResult {
  const roles = Object.keys(SIM_HEADCOUNT) as RoleName[];
  const weights: Partial<Record<RoleName, number>> = {};
  let totalWeight = 0;

  for (const role of roles) {
    const coef = config.roleCoefficients[role] ?? 0;
    const w = coef * SIM_HEADCOUNT[role];
    weights[role] = w;
    totalWeight += w;
  }

  const capPerPerson = (config.maxSharePct / 100) * pool;
  const byRole: Partial<Record<RoleName, RoleSimData>> = {};
  let overflow = 0;
  let cappedCount = 0;

  for (const role of roles) {
    const w = weights[role] ?? 0;
    const rawTotal = totalWeight > 0 ? (w / totalWeight) * pool : 0;
    const rawPerPerson = SIM_HEADCOUNT[role] > 0 ? rawTotal / SIM_HEADCOUNT[role] : 0;
    let perPerson = rawPerPerson;

    if (perPerson > capPerPerson) {
      cappedCount += SIM_HEADCOUNT[role];
      overflow += (perPerson - capPerPerson) * SIM_HEADCOUNT[role];
      perPerson = capPerPerson;
    }

    const total = perPerson * SIM_HEADCOUNT[role];
    byRole[role] = {
      headcount: SIM_HEADCOUNT[role],
      perPerson,
      total,
      share: pool > 0 ? total / pool : 0,
    };
  }

  const totalDistributed = Object.values(byRole).reduce<number>((s, r) => s + (r?.total ?? 0), 0);
  const perPersonValues = Object.values(byRole).flatMap<number>((r) =>
    r ? Array<number>(r.headcount).fill(r.perPerson) : [],
  );

  return {
    byRole,
    totalDistributed,
    overflow,
    cappedCount,
    min: perPersonValues.length ? Math.min(...perPersonValues) : 0,
    max: perPersonValues.length ? Math.max(...perPersonValues) : 0,
    avg: perPersonValues.length
      ? perPersonValues.reduce((s, v) => s + v, 0) / perPersonValues.length
      : 0,
  };
}

// ── Stat chip ─────────────────────────────────────────────────────────────

function SimStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'dim' | 'default' | 'warn';
}) {
  const color = tone === 'warn' ? 'text-st-gold' : tone === 'dim' ? 'text-st-sec' : 'text-st-hi';
  return (
    <div className="flex flex-col gap-1 p-2.5 bg-st-raised border border-st-border rounded-sm">
      <span className="st-eyebrow text-[8.5px] text-st-dim">{label}</span>
      <span className={cn('font-mono tabular-nums text-[14px] font-medium', color)}>{value}</span>
    </div>
  );
}

// ── Quick amount buttons ──────────────────────────────────────────────────

const QUICK_AMOUNTS = [500, 1000, 2000, 4000] as const;

// ── Main component ────────────────────────────────────────────────────────

interface SimulationCardProps {
  config: DistributionConfig;
}

export function DistributionSimulationCard({ config }: SimulationCardProps) {
  const [pool, setPool] = useState(1000);
  const [localPool, setLocalPool] = useState('1000');

  const sim = useMemo(() => simulate(config, pool), [config, pool]);
  const roles = Object.keys(SIM_HEADCOUNT) as RoleName[];
  const totalHeadcount = Object.values(SIM_HEADCOUNT).reduce((s, n) => s + n, 0);

  const commitPool = () => {
    const n = parseFloat(localPool);
    if (!isNaN(n) && n >= 0) {
      setPool(n);
    } else {
      setLocalPool(String(pool));
    }
  };

  return (
    <div className="bg-st-card border border-st-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start gap-3 px-5 py-4 border-b border-st-border"
        style={{
          background:
            'linear-gradient(135deg, var(--st-d-1, #0F1422), color-mix(in oklch, #6366F1 4%, #0F1422))',
        }}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-st-indigo/12 flex items-center justify-center">
          <Zap size={14} className="text-st-indigo-glow" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-st-indigo-glow animate-pulse" />
            <p className="st-eyebrow text-st-indigo-glow text-[9.5px]">Simulation en direct</p>
          </div>
          <h2 className="font-display text-[20px] text-st-hi leading-tight">
            Aperçu de la distribution
          </h2>
        </div>
      </div>

      {/* Pool input */}
      <div className="px-5 pt-4 pb-3 border-b border-st-border">
        <p className="text-[11px] text-st-dim font-mono uppercase tracking-wider mb-2">
          Pool de pourboires à simuler
        </p>
        <div className="flex items-center gap-2 bg-st-bg rounded-md border border-st-border px-4 py-2 mb-3">
          <span className="font-mono text-[24px] text-st-sec">$</span>
          <input
            type="number"
            min={0}
            step={50}
            value={localPool}
            onChange={(e) => setLocalPool(e.target.value)}
            onBlur={commitPool}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="flex-1 bg-transparent border-0 outline-none font-mono tabular-nums text-[24px] text-st-hi font-medium min-w-0"
            aria-label="Montant du pool à simuler"
          />
        </div>
        {/* Quick-pick amounts */}
        <div className="flex gap-2 flex-wrap">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => {
                setPool(amt);
                setLocalPool(String(amt));
              }}
              className={cn(
                'px-2.5 py-1 text-[11px] font-mono rounded-pill border transition-all duration-150',
                pool === amt
                  ? 'bg-st-stroke border-st-muted text-st-hi'
                  : 'bg-st-raised border-st-border text-st-sec hover:text-st-hi hover:border-st-muted',
              )}
            >
              ${amt}
            </button>
          ))}
        </div>
      </div>

      {/* Stacked bar */}
      <div className="px-5 pt-4 pb-3">
        <p className="st-eyebrow text-st-sec text-[9.5px] mb-2.5">Répartition par rôle</p>
        <div className="flex h-2.5 rounded-pill overflow-hidden bg-st-stroke">
          {roles.map((role) => {
            const data = sim.byRole[role];
            if (!data || data.share === 0) return null;
            return (
              <div
                key={role}
                className="h-full transition-[width] duration-200 hover:brightness-125"
                style={{
                  width: `${data.share * 100}%`,
                  background: ROLE_META[role].color,
                }}
                title={`${ROLE_META[role].label}: $${data.total.toFixed(2)}`}
              />
            );
          })}
        </div>
      </div>

      {/* Per-role breakdown */}
      <div className="px-5 pb-1">
        {roles.map((role) => {
          const data = sim.byRole[role];
          const meta = ROLE_META[role];
          if (!data) return null;
          return (
            <div
              key={role}
              className="grid grid-cols-[10px_1fr_44px_80px] gap-2.5 items-center py-2 border-b border-dashed border-st-border last:border-b-0"
            >
              {/* Color dot */}
              <span
                className="w-2 h-2 rounded-[2px] flex-shrink-0"
                style={{ background: meta.color }}
              />
              {/* Role info */}
              <div className="min-w-0">
                <p className="text-[12.5px] text-st-hi truncate">{meta.label}</p>
                <p className="text-[10.5px] text-st-dim">
                  {data.headcount}× · ${data.perPerson.toFixed(2)}/pers.
                </p>
              </div>
              {/* Share % */}
              <span className="font-mono text-[11px] text-st-sec text-right tabular-nums">
                {(data.share * 100).toFixed(1)}%
              </span>
              {/* Total */}
              <span className="font-mono tabular-nums text-[13.5px] text-st-hi text-right">
                ${data.total.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="px-5 pt-3 pb-4 mt-2 border-t border-st-border bg-st-bg/60 flex flex-col gap-3">
        {/* Total */}
        <div className="flex items-baseline justify-between">
          <span className="st-eyebrow text-st-sec text-[9.5px]">Total redistribué</span>
          <span className="font-mono tabular-nums text-[18px] text-st-hi font-medium">
            ${sim.totalDistributed.toFixed(2)}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <SimStat label="Min individuel" value={`$${sim.min.toFixed(2)}`} tone="dim" />
          <SimStat label="Moy. / pers." value={`$${sim.avg.toFixed(2)}`} tone="default" />
          <SimStat
            label="Max individuel"
            value={`$${sim.max.toFixed(2)}`}
            tone={sim.cappedCount > 0 ? 'warn' : 'default'}
          />
        </div>

        {/* Cap warning */}
        {sim.cappedCount > 0 && (
          <div className="flex gap-2.5 items-start p-2.5 rounded-sm bg-st-gold/6 border border-st-gold/25">
            <AlertTriangle size={12} className="text-st-gold mt-0.5 flex-shrink-0" />
            <p className="text-[11.5px] text-st-pri leading-relaxed">
              <strong className="text-st-gold">
                {sim.cappedCount} employé{sim.cappedCount > 1 ? 's' : ''} au plafond
              </strong>{' '}
              — le surplus de ${sim.overflow.toFixed(2)} sera redistribué.
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10.5px] text-st-dim font-mono text-center">
          Simulation indicative · équipe type · {totalHeadcount} personnes.
          <br />
          Ne remplace pas le moteur de calcul backend.
        </p>
      </div>
    </div>
  );
}
