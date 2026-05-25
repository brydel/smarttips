'use client';

import { TrendingUp, CalendarDays, BarChart2, Coins } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { EmployeeDashboardSummary } from '../types/employee.types';
import { fmtMoneyShort } from '../utils/employee-formatters';

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accentClass: string;
  notImplemented?: boolean;
}

function KpiCard({ icon, label, value, hint, accentClass, notImplemented }: KpiCardProps) {
  return (
    <div className="bg-st-card border border-st-border rounded-xl p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
            accentClass,
          )}
        >
          {icon}
        </span>
        {notImplemented && (
          <span className="text-[9.5px] font-mono uppercase tracking-wider text-st-dim border border-st-border rounded-pill px-1.5 py-0.5">
            Bientôt
          </span>
        )}
      </div>

      <div>
        <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-st-dim mb-1">
          {label}
        </div>
        {notImplemented ? (
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-mono text-st-dim leading-none">—</span>
          </div>
        ) : (
          <div className="text-[22px] font-mono text-st-gold-glow leading-none font-medium">
            {value}
          </div>
        )}
        {hint && <p className="text-[11px] text-st-dim mt-1 font-sans">{hint}</p>}
      </div>
    </div>
  );
}

interface EmployeeTipSummaryCardsProps {
  summary?: EmployeeDashboardSummary;
  notImplemented?: boolean;
}

export function EmployeeTipSummaryCards({ summary, notImplemented }: EmployeeTipSummaryCardsProps) {
  const cards: KpiCardProps[] = [
    {
      label: 'Cette semaine',
      value: summary ? fmtMoneyShort(summary.weekTotal) : '—',
      icon: <TrendingUp size={15} className="text-st-emerald-glow" />,
      accentClass: 'bg-st-emerald/10',
      hint: '7 derniers jours',
      notImplemented: notImplemented || !summary,
    },
    {
      label: 'Ce mois',
      value: summary ? fmtMoneyShort(summary.monthTotal) : '—',
      icon: <CalendarDays size={15} className="text-st-indigo-glow" />,
      accentClass: 'bg-st-indigo/10',
      hint: '30 derniers jours',
      notImplemented: notImplemented || !summary,
    },
    {
      label: 'Shifts ce mois',
      value: summary ? String(summary.monthShiftCount) : '—',
      icon: <BarChart2 size={15} className="text-st-gold" />,
      accentClass: 'bg-st-gold/10',
      notImplemented: notImplemented || !summary,
    },
    {
      label: 'Moyenne / shift',
      value: summary ? fmtMoneyShort(summary.averagePerShift) : '—',
      icon: <Coins size={15} className="text-st-emerald-glow" />,
      accentClass: 'bg-st-emerald/10',
      notImplemented: notImplemented || !summary,
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}
