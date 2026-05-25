'use client';

import Link from 'next/link';
import type { RoleBreakdown } from '../../../types/dashboard';

// Fallback role breakdown when no TipDistributions exist yet
const FALLBACK: RoleBreakdown[] = [
  { role: 'SERVER', label: 'Serveurs', color: '#6366F1', total: 0, share: 0.38 },
  { role: 'BARTENDER', label: 'Bar', color: '#D4A574', total: 0, share: 0.22 },
  { role: 'BUSSER', label: 'Aide de salle', color: '#10B981', total: 0, share: 0.18 },
  { role: 'COOK', label: 'Cuisine', color: '#3A4366', total: 0, share: 0.14 },
  { role: 'HOST', label: 'Accueil', color: '#252D45', total: 0, share: 0.08 },
];

interface RolesCardProps {
  breakdown: RoleBreakdown[];
  /** Live order total to annotate the header */
  liveTotal?: number;
}

export function RolesCard({ breakdown, liveTotal }: RolesCardProps) {
  const rows = breakdown.length > 0 ? breakdown : FALLBACK;
  const total =
    breakdown.length > 0 ? breakdown.reduce((s, r) => s + r.total, 0) : (liveTotal ?? 4247);

  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3.5">
        <div>
          <span
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium block mb-1"
            style={{ color: 'var(--st-d-7)' }}
          >
            Répartition par rôle
          </span>
          <h3
            className="text-[18px] leading-none"
            style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--st-d-9)' }}
          >
            Ce soir ·{' '}
            <span className="font-mono" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
              ${total.toFixed(0)}
            </span>
          </h3>
        </div>
        <Link
          href="/dashboard/tip-policy"
          className="text-[11.5px] hover:opacity-80 transition-opacity"
          style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}
        >
          Politique →
        </Link>
      </div>

      {/* Stacked bar */}
      <div
        className="flex h-2 rounded-pill overflow-hidden mb-4"
        role="img"
        aria-label="Répartition des pourboires par rôle"
        style={{ background: 'var(--st-d-3)' }}
      >
        {rows.map((r) => (
          <div
            key={r.role}
            title={`${r.label} : ${(r.share * 100).toFixed(0)}%`}
            style={{
              width: `${r.share * 100}%`,
              background: r.color,
              transition: 'width .3s ease',
            }}
          />
        ))}
      </div>

      {/* Role list */}
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.role}
            className="grid items-center gap-2.5"
            style={{ gridTemplateColumns: '14px 1fr auto 44px' }}
          >
            <span
              className="w-2.5 h-2.5 rounded-[2px]"
              style={{ background: r.color }}
              aria-hidden="true"
            />
            <span className="text-[12.5px]" style={{ color: 'var(--st-d-8)' }}>
              {r.label}
            </span>
            <span
              className="font-mono font-medium tabular-nums text-[13px] text-right"
              style={{ color: 'var(--st-d-9)' }}
            >
              {r.total > 0 ? `$${r.total.toFixed(0)}` : `$${(total * r.share).toFixed(0)}`}
            </span>
            <span className="font-mono text-[11px] text-right" style={{ color: 'var(--st-d-6)' }}>
              {(r.share * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
