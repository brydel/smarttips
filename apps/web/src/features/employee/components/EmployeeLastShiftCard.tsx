'use client';

import Link from 'next/link';
import { Clock, ArrowRight, Info } from 'lucide-react';
import type { EmployeeLastShift } from '../types/employee.types';
import {
  fmtShiftDate,
  fmtShiftType,
  fmtRole,
  fmtHours,
  fmtMoneyShort,
  buildShortExplain,
} from '../utils/employee-formatters';

interface EmployeeLastShiftCardProps {
  lastShift?: EmployeeLastShift | null;
  notImplemented?: boolean;
}

export function EmployeeLastShiftCard({ lastShift, notImplemented }: EmployeeLastShiftCardProps) {
  // Not implemented state
  if (notImplemented || lastShift === undefined) {
    return (
      <div className="bg-st-card border border-st-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-st-dim" />
            <span className="text-[12px] font-medium text-st-sec font-sans">Dernier shift</span>
          </div>
          <span className="text-[9.5px] font-mono uppercase tracking-wider text-st-dim border border-st-border rounded-pill px-1.5 py-0.5">
            Bientôt
          </span>
        </div>
        <p className="text-[12.5px] text-st-dim font-sans leading-relaxed">
          Votre dernier shift et le montant reçu apparaîtront ici.
        </p>
      </div>
    );
  }

  // Empty state (no shift yet)
  if (!lastShift) {
    return (
      <div className="bg-st-card border border-st-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-st-dim" />
          <span className="text-[12px] font-medium text-st-sec font-sans">Dernier shift</span>
        </div>
        <p className="text-[12.5px] text-st-dim font-sans">Aucun shift trouvé pour le moment.</p>
      </div>
    );
  }

  const explainText = lastShift.explanation
    ? buildShortExplain(lastShift.explanation)
    : 'Calcul selon les règles du restaurant.';

  return (
    <div
      className="bg-st-card border border-st-border rounded-xl overflow-hidden"
      style={{ borderColor: 'rgba(212,165,116,.2)' }}
    >
      {/* Header */}
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{
          background: 'rgba(212,165,116,.04)',
          borderBottom: '1px solid rgba(212,165,116,.15)',
        }}
      >
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-st-gold" />
          <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-st-gold">
            Dernier shift
          </span>
        </div>
        <span className="text-[11px] text-st-dim font-sans">{fmtShiftDate(lastShift.date)}</span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="text-[13.5px] text-st-hi font-medium font-sans">
            {fmtShiftType(lastShift.shiftType)}
          </div>
          <div className="flex items-center flex-wrap gap-2 text-[12px] text-st-sec font-sans">
            <span>{fmtRole(lastShift.role)}</span>
            {lastShift.hoursWorked && (
              <>
                <span className="text-st-dim">·</span>
                <span className="font-mono">{fmtHours(lastShift.hoursWorked)}</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[24px] font-mono text-st-gold-glow leading-none font-medium">
            {fmtMoneyShort(lastShift.amount)}
          </div>
          <div className="text-[10px] text-st-dim font-sans mt-0.5">reçu</div>
        </div>
      </div>

      {/* Explanation */}
      <div
        className="mx-4 mb-4 p-3 rounded-lg flex items-start gap-2.5"
        style={{ background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.15)' }}
      >
        <Info size={12} className="text-st-indigo-glow mt-0.5 shrink-0" />
        <p className="text-[11.5px] text-st-sec font-sans leading-relaxed">{explainText}</p>
      </div>

      {/* CTA */}
      <div className="px-5 pb-4">
        <Link
          href="/employee/shifts"
          className="inline-flex items-center gap-1.5 text-[12px] text-st-indigo-glow font-medium font-sans hover:opacity-80 transition-opacity"
        >
          Voir mon historique complet <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
