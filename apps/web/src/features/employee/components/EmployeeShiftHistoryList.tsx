'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CalendarDays, Info } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { EmployeeShiftRecord, TipPeriod } from '../types/employee.types';
import {
  fmtShiftDate,
  fmtShiftType,
  fmtRole,
  fmtHours,
  fmtMoneyShort,
  fmtPercent,
  buildShortExplain,
} from '../utils/employee-formatters';

// ── Period filter ─────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: TipPeriod; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: 'all', label: 'Tout' },
];

interface PeriodPickerProps {
  value: TipPeriod;
  onChange: (v: TipPeriod) => void;
}

function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  return (
    <div
      className="flex gap-0.5 p-0.5 rounded-[8px] border border-st-border"
      style={{ background: 'var(--st-d-1)' }}
      role="group"
      aria-label="Période"
    >
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-[6px] text-[11.5px] font-sans transition-all duration-150',
            value === opt.value
              ? 'bg-st-raised text-st-hi font-medium'
              : 'text-st-dim hover:text-st-sec',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface ShiftRowProps {
  record: EmployeeShiftRecord;
}

function ShiftRow({ record }: ShiftRowProps) {
  const [expanded, setExpanded] = useState(false);

  const explainText = record.explanation ? buildShortExplain(record.explanation) : null;

  return (
    <div
      className={cn(
        'bg-st-card border rounded-xl overflow-hidden transition-all duration-150',
        expanded ? 'border-st-indigo/40' : 'border-st-border hover:border-st-muted',
      )}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-st-raised/30 transition-colors"
        aria-expanded={expanded}
      >
        {/* Date block */}
        <div
          className="flex flex-col items-center justify-center w-10 h-10 rounded-lg shrink-0 text-center"
          style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)' }}
        >
          <span className="text-[11px] font-mono text-st-indigo-glow leading-none">
            {new Date(record.date.split('T')[0] ?? record.date)
              .getDate()
              .toString()
              .padStart(2, '0')}
          </span>
          <span className="text-[8px] font-mono text-st-dim uppercase tracking-wide mt-0.5">
            {new Date(record.date.split('T')[0] ?? record.date).toLocaleString('fr-CA', {
              month: 'short',
            })}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-st-hi font-medium font-sans">
            {fmtShiftType(record.shiftType)}
          </div>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-st-sec font-sans mt-0.5">
            <span>{fmtRole(record.role)}</span>
            {record.hoursWorked && (
              <>
                <span className="text-st-dim">·</span>
                <span className="font-mono">{fmtHours(record.hoursWorked)}</span>
              </>
            )}
            {record.status && (
              <>
                <span className="text-st-dim">·</span>
                <span
                  className={cn(
                    'text-[9.5px] uppercase tracking-wide font-mono',
                    record.paidAt ? 'text-st-emerald-glow' : 'text-st-dim',
                  )}
                >
                  {record.paidAt ? 'Payé' : record.status}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="shrink-0 flex items-center gap-2">
          <div className="text-right">
            <div className="text-[16px] font-mono text-st-gold-glow font-medium leading-none">
              {fmtMoneyShort(record.amount)}
            </div>
            {record.poolSharePct && (
              <div className="text-[10px] font-mono text-st-dim mt-0.5">
                {fmtPercent(record.poolSharePct)} du pool
              </div>
            )}
          </div>
          {expanded ? (
            <ChevronUp size={14} className="text-st-dim" />
          ) : (
            <ChevronDown size={14} className="text-st-dim" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4 border-t"
          style={{ borderColor: 'rgba(99,102,241,.1)', background: 'rgba(15,20,34,.5)' }}
        >
          {/* Explanation sentence */}
          {explainText && (
            <div
              className="mt-3 p-3 rounded-lg flex items-start gap-2"
              style={{
                background: 'rgba(99,102,241,.05)',
                border: '1px solid rgba(99,102,241,.12)',
              }}
            >
              <Info size={11} className="text-st-indigo-glow mt-0.5 shrink-0" />
              <p className="text-[11.5px] text-st-sec font-sans leading-relaxed">{explainText}</p>
            </div>
          )}

          {/* Detail grid */}
          {record.explanation && (
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
              {record.explanation.roleCoefficient && (
                <DetailRow
                  label="Coef. rôle"
                  value={`×${parseFloat(record.explanation.roleCoefficient).toFixed(2)}`}
                />
              )}
              {record.explanation.employeeCoefficient &&
                parseFloat(record.explanation.employeeCoefficient) !== 1 && (
                  <DetailRow
                    label="Coef. perso"
                    value={`×${parseFloat(record.explanation.employeeCoefficient).toFixed(2)}`}
                  />
                )}
              {record.explanation.hoursWorked && (
                <DetailRow label="Heures" value={fmtHours(record.explanation.hoursWorked)} />
              )}
              {record.explanation.salesGenerated &&
                parseFloat(record.explanation.salesGenerated) > 0 && (
                  <DetailRow
                    label="Ventes"
                    value={fmtMoneyShort(record.explanation.salesGenerated)}
                  />
                )}
              {record.explanation.salesBonus &&
                parseFloat(record.explanation.salesBonus) > 1.0001 && (
                  <DetailRow
                    label="Bonus ventes"
                    value={`×${parseFloat(record.explanation.salesBonus).toFixed(2)}`}
                    highlight
                  />
                )}
              {record.explanation.rawScore && (
                <DetailRow
                  label="Score final"
                  value={parseFloat(record.explanation.rawScore).toFixed(4)}
                />
              )}
              {record.explanation.scoreShare && (
                <DetailRow
                  label="Part du pool"
                  value={`${(parseFloat(record.explanation.scoreShare) * 100).toFixed(2)}%`}
                />
              )}
              {record.explanation.rawAmount && (
                <DetailRow
                  label="Montant brut"
                  value={fmtMoneyShort(record.explanation.rawAmount)}
                />
              )}
              {record.explanation.minimumApplied && (
                <DetailRow
                  label="Minimum garanti"
                  value={fmtMoneyShort(record.explanation.minAmount ?? '0')}
                  highlight
                />
              )}
              {record.explanation.capApplied && (
                <DetailRow
                  label="Plafond appliqué"
                  value={fmtMoneyShort(record.explanation.capAmount ?? '0')}
                />
              )}
              {record.explanation.roundingAdjustmentCents !== undefined &&
                record.explanation.roundingAdjustmentCents !== 0 && (
                  <DetailRow
                    label="Arrondi"
                    value={`${record.explanation.roundingAdjustmentCents > 0 ? '+' : ''}${record.explanation.roundingAdjustmentCents}¢`}
                  />
                )}
              {record.explanation.finalAmount && (
                <DetailRow
                  label="Montant final"
                  value={fmtMoneyShort(record.explanation.finalAmount)}
                  highlight
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-st-border/40">
      <span className="text-[11.5px] text-st-dim font-sans">{label}</span>
      <span
        className={cn(
          'text-[11.5px] font-mono',
          highlight ? 'text-st-gold-glow font-medium' : 'text-st-sec',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface EmployeeShiftHistoryListProps {
  records?: EmployeeShiftRecord[];
  notImplemented?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  period: TipPeriod;
  onPeriodChange: (v: TipPeriod) => void;
}

export function EmployeeShiftHistoryList({
  records,
  notImplemented,
  isLoading,
  isError,
  period,
  onPeriodChange,
}: EmployeeShiftHistoryListProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Filters row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PeriodPicker value={period} onChange={onPeriodChange} />
        {records && (
          <span className="text-[11.5px] text-st-dim font-sans">
            {records.length} shift{records.length !== 1 ? 's' : ''} trouvé
            {records.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Not-implemented state */}
      {notImplemented && (
        <div className="rounded-xl border border-st-border bg-st-card p-8 flex flex-col items-center gap-4 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(212,165,116,.08)',
              border: '1px solid rgba(212,165,116,.2)',
            }}
          >
            <CalendarDays size={22} className="text-st-gold" />
          </div>
          <div>
            <p className="text-[14px] text-st-hi font-medium font-sans mb-1">
              Historique des pourboires
            </p>
            <p className="text-[12.5px] text-st-sec font-sans leading-relaxed max-w-xs">
              Votre historique détaillé par shift, avec les montants reçus et le détail du calcul,
              sera disponible prochainement.
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-md text-[11px] font-mono text-st-dim"
            style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)' }}
          >
            Backend requis · GET /employee/me/distributions
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && !notImplemented && (
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin text-st-indigo"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      )}

      {/* Error */}
      {isError && !notImplemented && (
        <div className="rounded-xl border border-st-border bg-st-card p-6 text-center">
          <p className="text-[13px] text-st-sec font-sans">
            Impossible de charger vos shifts. Réessayez.
          </p>
        </div>
      )}

      {/* Empty */}
      {!notImplemented && !isLoading && !isError && records?.length === 0 && (
        <div className="rounded-xl border border-st-border bg-st-card p-8 text-center">
          <CalendarDays size={24} className="text-st-dim mx-auto mb-3" />
          <p className="text-[13px] text-st-sec font-sans">
            Aucun shift trouvé pour cette période.
          </p>
        </div>
      )}

      {/* Records list */}
      {!notImplemented && records && records.length > 0 && (
        <div className="flex flex-col gap-2">
          {records.map((record) => (
            <ShiftRow key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
