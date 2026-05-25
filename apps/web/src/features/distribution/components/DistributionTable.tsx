'use client';

import { ChevronRight } from 'lucide-react';
import type { TipDistribution } from '../types/distribution.types';
import {
  ROLE_META,
  toNum,
  getRawScore,
  getHoursWorked,
  getSalesGenerated,
  poolSharePct,
} from '../utils/distribution-calculations';
import { DistributionExplanationPanel } from './DistributionExplanationPanel';
import { cn } from '../../../lib/cn';

interface DistributionTableProps {
  distributions: TipDistribution[];
  totalScore: number;
  poolTotal: number;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  hoveredRole: string | null;
  onHoverRole: (role: string | null) => void;
}

export function DistributionTable({
  distributions,
  totalScore,
  poolTotal,
  expandedId,
  onToggleExpand,
  hoveredRole,
  onHoverRole,
}: DistributionTableProps) {
  const totalHours = distributions.reduce((s, d) => s + getHoursWorked(d), 0);
  const totalSales = distributions.reduce((s, d) => s + getSalesGenerated(d), 0);

  return (
    <div className="flex flex-col gap-1">
      {/* Column headers — desktop only */}
      <div
        className="hidden lg:grid items-center px-4 pb-2"
        style={{
          gridTemplateColumns: '6px 1.8fr 90px 80px 90px 70px 110px 24px',
          gap: '14px',
          fontFamily: 'var(--font-jetbrains-mono)',
          fontSize: '9.5px',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: '#5A6485',
        }}
      >
        <span />
        <span>Employé · rôle</span>
        <span className="text-center">Heures</span>
        <span className="text-right">Ventes</span>
        <span className="text-right">Score</span>
        <span className="text-right">%</span>
        <span className="text-right">Part</span>
        <span />
      </div>

      {/* Employee rows */}
      {distributions.map((dist) => (
        <DistributionRow
          key={dist.id}
          distribution={dist}
          totalScore={totalScore}
          poolTotal={poolTotal}
          isExpanded={expandedId === dist.id}
          onToggle={() => onToggleExpand(dist.id)}
          isHighlighted={hoveredRole === dist.employee.role}
          isDimmed={!!hoveredRole && hoveredRole !== dist.employee.role}
          onHover={(role) => onHoverRole(role)}
        />
      ))}

      {/* Totals footer */}
      <div
        className="bg-st-card border border-st-border rounded-md mt-1 hidden lg:grid items-center px-4 py-3.5"
        style={{ gridTemplateColumns: '6px 1.8fr 90px 80px 90px 70px 110px 24px', gap: '14px' }}
      >
        <span />
        <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim">
          Total équipe
        </span>
        <span className="font-mono text-[13px] text-st-hi text-center">
          {totalHours.toFixed(1)}h
        </span>
        <span className="font-mono text-[12.5px] text-st-sec text-right">
          ${totalSales.toFixed(0)}
        </span>
        <span className="font-mono text-[13px] text-st-hi text-right">{totalScore.toFixed(2)}</span>
        <span className="font-mono text-[11px] text-st-sec text-right">100%</span>
        <span className="font-mono text-[14px] text-st-gold-glow text-right font-medium">
          ${poolTotal.toFixed(2)}
        </span>
        <span />
      </div>

      {/* Mobile footer */}
      <div className="lg:hidden flex justify-between items-center mt-2 px-1 text-[11px] text-st-dim font-mono border-t border-st-border pt-3">
        <span>
          {distributions.length} employés · {totalHours.toFixed(1)}h
        </span>
        <span className="text-st-gold-glow font-medium">${poolTotal.toFixed(2)}</span>
      </div>

      {/* Click hint */}
      <p className="text-[11px] text-st-dim text-center mt-2 hidden sm:block">
        Cliquez une ligne pour voir le détail du calcul
      </p>
    </div>
  );
}

// ── Single row ────────────────────────────────────────────────────────────────

interface DistributionRowProps {
  distribution: TipDistribution;
  totalScore: number;
  poolTotal: number;
  isExpanded: boolean;
  onToggle: () => void;
  isHighlighted: boolean;
  isDimmed: boolean;
  onHover: (role: string | null) => void;
}

function DistributionRow({
  distribution,
  totalScore,
  poolTotal,
  isExpanded,
  onToggle,
  isHighlighted,
  isDimmed,
  onHover,
}: DistributionRowProps) {
  const { employee } = distribution;
  const meta = ROLE_META[employee.role] ?? { label: employee.role, color: '#8892B0', icon: '●' };

  const amount = toNum(distribution.amount);
  const hours = getHoursWorked(distribution);
  const sales = getSalesGenerated(distribution);
  const score = getRawScore(distribution);
  const sharePct = poolSharePct(amount, poolTotal);

  return (
    <div
      className={cn(
        'rounded-md overflow-hidden transition-all duration-150',
        'border',
        isExpanded
          ? 'border-st-indigo shadow-indigo'
          : isHighlighted
            ? 'border-st-muted'
            : 'border-st-border hover:border-st-muted',
        isDimmed && 'opacity-40',
      )}
      style={{ background: 'var(--st-d-1, #0F1422)' }}
      onMouseEnter={() => onHover(employee.role)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Desktop summary row */}
      <button
        className={cn(
          'w-full text-left transition-colors duration-100',
          'hidden lg:grid items-center px-4 py-3',
          isExpanded ? 'bg-st-raised/50' : 'hover:bg-st-raised/30',
        )}
        style={{ gridTemplateColumns: '6px 1.8fr 90px 80px 90px 70px 110px 24px', gap: '14px' }}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${employee.firstName} ${employee.lastName} — ${fmtHumanAmount(amount)}`}
      >
        {/* Color marker */}
        <span
          className="rounded-[3px] self-stretch"
          style={{ background: meta.color, minHeight: 32, width: 5 }}
        />

        {/* Employee */}
        <div className="flex items-center gap-2.5 min-w-0">
          <RoleAvatar
            name={`${employee.firstName} ${employee.lastName}`}
            color={meta.color}
            icon={meta.icon}
          />
          <div className="min-w-0">
            <div className="text-[13.5px] text-st-hi truncate">
              {employee.firstName} {employee.lastName}
            </div>
            <div className="text-[11px] text-st-sec">{meta.label}</div>
          </div>
        </div>

        {/* Hours */}
        <span className="font-mono text-[13px] text-st-pri text-center">{hours.toFixed(1)}h</span>

        {/* Sales */}
        <span className="font-mono text-[12.5px] text-st-sec text-right">
          {sales > 0 ? `$${sales.toFixed(0)}` : '—'}
        </span>

        {/* Score */}
        <div className="text-right">
          <span className="font-mono text-[13px] text-st-hi">{score.toFixed(2)}</span>
          {totalScore > 0 && (
            <div className="text-[9.5px] font-mono text-st-dim">/ {totalScore.toFixed(2)}</div>
          )}
        </div>

        {/* % bar */}
        <div>
          <div className="flex h-1 bg-st-border rounded-full overflow-hidden mb-1">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((sharePct / 35) * 100, 100)}%`,
                background: meta.color,
              }}
            />
          </div>
          <div className="font-mono text-[10px] text-st-dim text-right">{sharePct.toFixed(1)}%</div>
        </div>

        {/* Amount */}
        <span className="font-mono text-[15px] text-st-gold-glow text-right font-medium">
          ${amount.toFixed(2)}
        </span>

        {/* Chevron */}
        <ChevronRight
          size={14}
          className="text-st-dim justify-self-center transition-transform duration-200"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Mobile summary row */}
      <button
        className="w-full text-left flex items-center gap-3 px-3 py-3 lg:hidden hover:bg-st-raised/30 transition-colors"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${employee.firstName} ${employee.lastName} — ${fmtHumanAmount(amount)}`}
      >
        <span
          className="w-1.5 self-stretch rounded-full shrink-0"
          style={{ background: meta.color, minHeight: 36 }}
        />
        <RoleAvatar
          name={`${employee.firstName} ${employee.lastName}`}
          color={meta.color}
          icon={meta.icon}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-st-hi truncate font-medium">
              {employee.firstName} {employee.lastName}
            </span>
            <span className="font-mono text-[14px] text-st-gold-glow shrink-0 font-medium">
              ${amount.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-st-sec">
            <span>{meta.label}</span>
            <span className="text-st-dim">·</span>
            <span className="font-mono">{hours.toFixed(1)}h</span>
            <span className="text-st-dim">·</span>
            <span className="font-mono">{sharePct.toFixed(1)}%</span>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="text-st-dim shrink-0 transition-transform duration-200"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Expandable explanation */}
      {isExpanded && (
        <DistributionExplanationPanel
          distribution={distribution}
          totalScore={totalScore}
          poolTotal={poolTotal}
        />
      )}
    </div>
  );
}

// ── Mini helpers ──────────────────────────────────────────────────────────────

function fmtHumanAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

interface RoleAvatarProps {
  name: string;
  color: string;
  icon: string;
}

function RoleAvatar({ name, color, icon }: RoleAvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  return (
    <div
      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-[11px] font-medium relative"
      style={{
        background: `color-mix(in srgb, ${color} 15%, #141A2B)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, #252D45)`,
      }}
      aria-hidden="true"
      title={icon}
    >
      {initials}
    </div>
  );
}
