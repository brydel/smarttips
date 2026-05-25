'use client';

import type { DistributionSummary } from '../types/distribution.types';
import { cn } from '../../../lib/cn';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'gold' | 'emerald' | 'indigo' | 'default';
}

function KpiCard({ label, value, sub, tone = 'default' }: KpiCardProps) {
  const valueColor = {
    gold: 'text-st-gold-glow',
    emerald: 'text-st-emerald-glow',
    indigo: 'text-st-indigo-glow',
    default: 'text-st-hi',
  }[tone];

  return (
    <div className="bg-st-card border border-st-border rounded-lg p-3.5 sm:p-4 flex flex-col gap-1.5 min-w-0">
      <div className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim">{label}</div>
      <div className={cn('font-mono font-medium text-xl sm:text-2xl leading-none', valueColor)}>
        {value}
      </div>
      {sub && <div className="text-[10.5px] font-mono text-st-dim truncate">{sub}</div>}
    </div>
  );
}

interface DistributionKpiCardsProps {
  summary: DistributionSummary;
}

export function DistributionKpiCards({ summary }: DistributionKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
      <KpiCard
        label="Pool total"
        value={`$${summary.poolTotal.toFixed(2)}`}
        sub="Cash + carte"
        tone="gold"
      />
      <KpiCard label="Employés inclus" value={`${summary.employeeCount}`} sub="dans ce shift" />
      <KpiCard
        label="Montant moyen"
        value={`$${summary.avgAmount.toFixed(2)}`}
        sub="par personne"
        tone="indigo"
      />
      <KpiCard
        label="Plus grosse part"
        value={`$${summary.maxAmount.toFixed(2)}`}
        sub={`$${summary.minAmount.toFixed(2)} min`}
        tone="emerald"
      />
      <KpiCard
        label="Méthode"
        value={summary.computationMethod === 'RULES' ? 'RULES' : 'ML'}
        sub={summary.computationMethod === 'RULES' ? 'Règles pondérées' : 'IA assistée'}
        tone={summary.computationMethod === 'RULES' ? 'indigo' : 'gold'}
      />
    </div>
  );
}
