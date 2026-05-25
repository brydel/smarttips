'use client';

import { ArrowLeft, Calendar, Users, Hash, Zap } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '../../../components/ui/badge';
import type { Shift } from '../../../types/shift';
import type { DistributionSummary } from '../types/distribution.types';
import { fmtComputationMethod, fmtShiftType } from '../utils/distribution-formatters';
import { cn } from '../../../lib/cn';

interface DistributionHeaderProps {
  shift: Shift | null;
  summary: DistributionSummary | null;
  shiftId: string;
}

const SHIFT_TYPE_COLORS: Record<string, string> = {
  BREAKFAST: 'text-st-gold-glow',
  LUNCH: 'text-st-emerald-glow',
  DINNER: 'text-st-indigo-glow',
  LATE_NIGHT: 'text-st-sec',
};

export function DistributionHeader({ shift, summary, shiftId }: DistributionHeaderProps) {
  const shiftDate = shift?.date
    ? format(new Date(shift.date), 'EEEE d MMMM yyyy', { locale: fr })
    : null;

  const shiftTypeColor = shift ? (SHIFT_TYPE_COLORS[shift.shiftType] ?? 'text-st-sec') : '';

  return (
    <header className="shrink-0 border-b border-st-border bg-st-card">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-3 text-[11.5px] font-mono text-st-dim">
          <Link
            href="/dashboard/shifts"
            className="flex items-center gap-1.5 hover:text-st-sec transition-colors"
          >
            <ArrowLeft size={12} />
            Shifts
          </Link>
          <span>/</span>
          <span className="text-st-sec truncate max-w-[120px]">{shiftId.slice(0, 8)}…</span>
          <span>/</span>
          <span className="text-st-hi">Distribution</span>
        </nav>

        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-[28px] text-st-hi leading-tight">
              Répartition des pourboires
            </h1>
            <p className="text-[13px] text-st-sec mt-1">
              Comprenez comment le pool de pourboires a été réparti pour ce shift.
            </p>
          </div>

          {/* Shift type badge */}
          {shift && (
            <Badge
              tone="neutral"
              className={cn('shrink-0 self-start sm:self-auto', shiftTypeColor)}
            >
              {fmtShiftType(shift.shiftType)}
            </Badge>
          )}
        </div>

        {/* Meta strip */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-[12px] text-st-sec">
          {shiftDate && (
            <span className="flex items-center gap-1.5">
              <Calendar size={12} className="text-st-dim shrink-0" />
              <span className="capitalize">{shiftDate}</span>
            </span>
          )}

          {summary && (
            <>
              <span className="flex items-center gap-1.5">
                <Users size={12} className="text-st-dim shrink-0" />
                <span>
                  <span className="font-mono text-st-hi">{summary.employeeCount}</span> employés
                </span>
              </span>

              <span className="flex items-center gap-1.5">
                <Hash size={12} className="text-st-dim shrink-0" />
                <span>
                  Pool :{' '}
                  <span className="font-mono text-st-gold-glow">
                    ${summary.poolTotal.toFixed(2)}
                  </span>
                </span>
              </span>

              <span className="flex items-center gap-1.5">
                <Zap size={12} className="text-st-dim shrink-0" />
                <span>{fmtComputationMethod(summary.computationMethod)}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
