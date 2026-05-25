'use client';

/**
 * Inline KPI + insight widgets for the dashboard overview.
 * Exported: WeekKpi · FairnessKpi · ActionableKpi · InsightsCard
 */

import Link from 'next/link';
import { TrendingUp, Lock, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import type { DashboardAlert } from '../../../types/dashboard';

// ── Sparkline (pure SVG, no recharts needed for small sparklines) ──────────────

function Sparkline({
  data,
  color,
  w = 140,
  h = 40,
}: {
  data: number[];
  color: string;
  w?: number;
  h?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / range) * h}`)
    .join(' ');
  const last = data[data.length - 1];
  const lastX = w;
  const lastY = h - ((last - min) / range) * h;
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

// ── WeekKpi ────────────────────────────────────────────────────────────────────

interface WeekKpiProps {
  total: number;
  prevTotal: number;
  dailyData: number[]; // last 7 values for sparkline
}

export function WeekKpi({ total, prevTotal, dailyData }: WeekKpiProps) {
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const isUp = delta >= 0;
  const [intPart, decPart] = total.toFixed(2).split('.');
  return (
    <div
      className="rounded-[14px] border border-st-border bg-st-card p-[18px] relative overflow-hidden"
      style={{ minHeight: 110 }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
          style={{ color: 'var(--st-d-7)' }}
        >
          Pourboires · 7 jours
        </span>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[10.5px] font-medium border"
          style={{
            color: isUp ? 'var(--st-emerald-glow)' : 'var(--st-danger)',
            background: isUp ? 'rgba(16,185,129,.07)' : 'rgba(239,68,68,.07)',
            borderColor: isUp ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)',
          }}
        >
          <TrendingUp size={9} />
          {isUp ? '+' : ''}
          {delta.toFixed(1)}%
        </span>
      </div>
      <span
        className="font-mono font-medium tabular-nums tracking-[-0.02em] leading-none"
        style={{
          fontSize: 40,
          color: 'var(--st-d-9)',
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 2,
        }}
      >
        <span style={{ fontSize: 22, opacity: 0.55 }}>$</span>
        {Number(intPart).toLocaleString('fr-FR')}
        <span style={{ fontSize: 22, opacity: 0.55 }}>.{decPart}</span>
      </span>
      <p className="text-[11px] mt-1" style={{ color: 'var(--st-d-6)' }}>
        vs. sem. précédente{' '}
        <span className="font-mono" style={{ color: 'var(--st-d-8)' }}>
          ${prevTotal.toFixed(0)}
        </span>
      </p>
      <div
        className="absolute right-[-8px] bottom-[-4px] opacity-40 pointer-events-none"
        aria-hidden="true"
      >
        <Sparkline data={dailyData} w={140} h={42} color="var(--st-emerald)" />
      </div>
    </div>
  );
}

// ── FairnessKpi ────────────────────────────────────────────────────────────────

export function FairnessKpi({ value }: { value: number | null }) {
  const score = value ?? 0;
  const sparkData = [88, 89, 89, 90, 91, 92, 93, score];
  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-[18px]">
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
          style={{ color: 'var(--st-d-7)' }}
        >
          Score d&apos;équité
        </span>
        {value !== null && (
          <span className="text-[10.5px] font-mono" style={{ color: 'var(--st-gold)' }}>
            ↑ +2.4 pts
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span
          className="font-mono font-medium tabular-nums tracking-[-0.02em] leading-none"
          style={{ fontSize: 40, color: value === null ? 'var(--st-d-5)' : 'var(--st-gold)' }}
        >
          {value === null ? '—' : score}
        </span>
        <span className="font-mono text-[12px]" style={{ color: 'var(--st-d-6)' }}>
          /100
        </span>
      </div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--st-d-6)' }}>
        {value === null ? 'Aucune distribution ce mois' : 'Excellent · cible 85+'}
      </p>
      <div className="mt-2.5" aria-hidden="true">
        <Sparkline data={sparkData} w={220} h={26} color="var(--st-gold)" />
      </div>
    </div>
  );
}

// ── ActionableKpi ─────────────────────────────────────────────────────────────

const ALERT_CFG = {
  NO_TIP_POOL: {
    tone: 'emerald' as const,
    icon: <Lock size={13} />,
    label: 'Clôturer shift',
    href: '/dashboard/shifts',
  },
  NO_HOURS: {
    tone: 'gold' as const,
    icon: <AlertTriangle size={13} />,
    label: 'Heures manquantes',
    href: '/dashboard/shifts',
  },
};

const TONE_CFG = {
  emerald: { bg: 'rgba(16,185,129,.12)', c: 'var(--st-emerald-glow)' },
  indigo: { bg: 'rgba(99,102,241,.12)', c: 'var(--st-indigo-glow)' },
  gold: { bg: 'rgba(212,165,116,.14)', c: 'var(--st-gold)' },
};

export function ActionableKpi({ alerts }: { alerts: DashboardAlert[] }) {
  const count = alerts.length;

  if (count === 0) {
    return (
      <div className="rounded-[14px] border border-st-border bg-st-card p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
            style={{ color: 'var(--st-d-7)' }}
          >
            À traiter · 0
          </span>
          <Link
            href="/dashboard/shifts"
            className="text-[11.5px] hover:opacity-80 transition-opacity"
            style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}
          >
            Voir shifts →
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 py-5 text-center">
          <CheckCircle2
            size={22}
            style={{ color: 'var(--st-emerald-glow)', opacity: 0.85 }}
            aria-hidden="true"
          />
          <p className="text-[13px] font-medium" style={{ color: 'var(--st-d-8)' }}>
            Tout est en ordre
          </p>
          <p className="text-[11.5px]" style={{ color: 'var(--st-d-6)' }}>
            Aucune action requise pour le moment.
          </p>
        </div>
      </div>
    );
  }

  const items = alerts.slice(0, 3).map((a) => {
    const cfg = ALERT_CFG[a.type] ?? ALERT_CFG.NO_TIP_POOL;
    return {
      tone: cfg.tone,
      icon: cfg.icon,
      label: a.message.length > 37 ? a.message.slice(0, 37) + '…' : a.message,
      sub: a.type === 'NO_TIP_POOL' ? 'Pool à déclarer' : 'Heures à saisir',
      href: a.shiftId ? `/dashboard/shifts/${a.shiftId}` : '/dashboard/shifts',
    };
  });

  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
          style={{ color: 'var(--st-d-7)' }}
        >
          À traiter · {count}
        </span>
        <Link
          href="/dashboard/shifts"
          className="text-[11.5px] hover:opacity-80 transition-opacity"
          style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}
        >
          Tout traiter →
        </Link>
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((t, i) => {
          const cfg = TONE_CFG[t.tone];
          return (
            <Link
              key={i}
              href={t.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] hover:bg-st-raised transition-colors border border-transparent hover:border-st-border"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span
                className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0"
                style={{ background: cfg.bg, color: cfg.c }}
              >
                {t.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] truncate" style={{ color: 'var(--st-d-9)' }}>
                  {t.label}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--st-d-6)' }}>
                  {t.sub}
                </p>
              </div>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--st-d-6)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── InsightsCard ──────────────────────────────────────────────────────────────

interface Insight {
  kind: string;
  tone: 'gold' | 'emerald' | 'indigo';
  title: string;
  desc: string;
}

// Static insights — will be replaced by ML recommendations API in a future ticket
const STATIC_INSIGHTS: Insight[] = [
  {
    kind: 'Opportunité',
    tone: 'gold',
    title: 'Vendredi soir : hausse de 18 %',
    desc: 'Les serveurs de la section Terrasse surperforment. Renforcer cette zone rapporterait ~$320 de plus.',
  },
  {
    kind: 'Équité',
    tone: 'emerald',
    title: 'Cuisine sous-récompensée',
    desc: 'Le ratio cuisine/salle est à 0.31 — en dessous de votre politique (0.40). Ajustement recommandé.',
  },
  {
    kind: 'Win',
    tone: 'emerald',
    title: 'Bar revenu au-dessus de la cible',
    desc: '2 semaines stables. Badge Or auto-attribué.',
  },
];

const INSIGHT_TONE_CFG = {
  gold: { c: 'var(--st-gold)', bg: 'rgba(212,165,116,.1)', bd: 'rgba(212,165,116,.3)' },
  emerald: { c: 'var(--st-emerald-glow)', bg: 'rgba(16,185,129,.08)', bd: 'rgba(16,185,129,.25)' },
  indigo: { c: 'var(--st-indigo-glow)', bg: 'rgba(99,102,241,.08)', bd: 'rgba(99,102,241,.3)' },
};

export function InsightsCard() {
  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-5">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Sparkles size={13} style={{ color: 'var(--st-gold)' }} />
          <span
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
            style={{ color: 'var(--st-gold)' }}
          >
            Recommandations IA
          </span>
        </div>
        <Link
          href="/dashboard/ai-insights"
          className="text-[11.5px] hover:opacity-80 transition-opacity"
          style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}
        >
          Tout voir →
        </Link>
      </div>
      <div className="flex flex-col gap-2.5">
        {STATIC_INSIGHTS.map((ins, i) => {
          const cfg = INSIGHT_TONE_CFG[ins.tone];
          return (
            <div
              key={i}
              className="p-3.5 rounded-[10px] border"
              style={{
                background: 'var(--st-d-2)',
                borderColor: 'var(--st-d-3)',
                borderLeft: `3px solid ${cfg.c}`,
              }}
            >
              <span
                className="inline-block px-2 py-0.5 rounded-pill font-mono text-[10px] uppercase tracking-[0.05em] mb-1.5"
                style={{ background: cfg.bg, color: cfg.c, border: `1px solid ${cfg.bd}` }}
              >
                {ins.kind}
              </span>
              <p className="text-[13.5px] font-medium mb-1" style={{ color: 'var(--st-d-9)' }}>
                {ins.title}
              </p>
              <p className="text-[12px] leading-[1.55]" style={{ color: 'var(--st-d-7)' }}>
                {ins.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
