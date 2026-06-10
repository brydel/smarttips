'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { CalendarDays, Download, FileText, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadAuditCsv,
  downloadPayrollCsv,
  downloadTipPoolPdf,
  saveReportBlob,
  type DateRangeReportParams,
} from '../../../../features/reports/api/reports.api';
import { extractErrorMessage } from '../../../../lib/errors';
import { cn } from '../../../../lib/cn';

type ExportKey = 'payroll' | 'audit' | 'tipPool';

function dateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function defaultRange(): DateRangeReportParams {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return { from: dateOnly(from), to: dateOnly(to) };
}

function isValidRange({ from, to }: DateRangeReportParams): boolean {
  if (!from || !to) return false;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const ms = end.getTime() - start.getTime();
  const days = ms / 86_400_000;
  return Number.isFinite(days) && days >= 0 && days <= 31;
}

export default function ReportsPage() {
  const [range, setRange] = useState<DateRangeReportParams>(() => defaultRange());
  const [shiftId, setShiftId] = useState('');
  const [busy, setBusy] = useState<ExportKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeIsValid = useMemo(() => isValidRange(range), [range]);

  async function runExport(key: ExportKey): Promise<void> {
    setError(null);

    if ((key === 'payroll' || key === 'audit') && !rangeIsValid) {
      setError('Choisissez une période valide de 31 jours maximum.');
      return;
    }

    if (key === 'tipPool' && !shiftId.trim()) {
      setError(
        'Renseignez le shiftId depuis un shift fermé ou utilisez l’export depuis sa distribution.',
      );
      return;
    }

    setBusy(key);
    try {
      if (key === 'payroll') {
        const blob = await downloadPayrollCsv(range);
        saveReportBlob(blob, `payroll_${range.from}_${range.to}.csv`);
        toast.success('Payroll CSV exporté');
      }
      if (key === 'audit') {
        const blob = await downloadAuditCsv(range);
        saveReportBlob(blob, `audit_${range.from}_${range.to}.csv`);
        toast.success('Audit CSV exporté');
      }
      if (key === 'tipPool') {
        const cleanShiftId = shiftId.trim();
        const blob = await downloadTipPoolPdf(cleanShiftId);
        saveReportBlob(blob, `tippool_${cleanShiftId}.pdf`);
        toast.success('Tip pool PDF exporté');
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Export impossible. Vérifiez les filtres et réessayez.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-st-bg">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[12.5px] text-st-sec">
              <span>Dashboard</span>
              <span className="text-st-muted">›</span>
              <span className="text-st-hi">Reports</span>
            </div>
            <h1 className="font-display text-[32px] leading-tight text-st-hi sm:text-[40px]">
              Reports <em className="italic text-st-sec">& audit.</em>
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-st-sec">
              Exportez les fichiers opérationnels déjà disponibles côté SmartTips: paie, tip pool
              par shift et audit trail CSV.
            </p>
          </div>
          <Link
            href="/dashboard/distributions"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-st-border bg-st-card px-3.5 py-2 text-[12.5px] font-medium text-st-hi transition-colors hover:bg-st-raised"
          >
            Ouvrir distributions
          </Link>
        </header>

        <section className="rounded-lg border border-st-border bg-st-card p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={15} className="text-st-indigo-glow" />
            <div>
              <p className="text-[13px] font-medium text-st-hi">Période d’export</p>
              <p className="text-[11.5px] text-st-sec">
                Payroll et audit acceptent 31 jours maximum.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 text-[12px] text-st-sec">
              Début
              <input
                type="date"
                value={range.from}
                onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
                className="rounded-md border border-st-border bg-st-raised px-3 py-2 text-[13px] text-st-hi outline-none focus:border-st-indigo"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] text-st-sec">
              Fin
              <input
                type="date"
                value={range.to}
                onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
                className="rounded-md border border-st-border bg-st-raised px-3 py-2 text-[13px] text-st-hi outline-none focus:border-st-indigo"
              />
            </label>
            <span
              className={cn(
                'rounded-pill border px-3 py-2 text-center font-mono text-[11px]',
                rangeIsValid
                  ? 'border-st-emerald/30 bg-st-emerald/10 text-st-emerald-glow'
                  : 'border-st-danger/30 bg-st-danger/10 text-st-danger',
              )}
            >
              {rangeIsValid ? 'Période valide' : 'À corriger'}
            </span>
          </div>
        </section>

        {error && (
          <div
            className="rounded-md border border-st-danger/30 bg-st-danger/10 px-4 py-3 text-[12.5px] text-st-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <ExportCard
            icon={<FileText size={17} />}
            title="Payroll CSV"
            eyebrow="Paie"
            description="Montants de paie et affectations calculées pour la période sélectionnée."
            buttonLabel="Exporter CSV"
            loading={busy === 'payroll'}
            onClick={() => void runExport('payroll')}
          />

          <ExportCard
            icon={<ShieldCheck size={17} />}
            title="Audit CSV"
            eyebrow="Audit & compliance"
            description="Historique des actions sensibles, exports et distributions. Aucun payload brut n’est affiché ici."
            buttonLabel="Exporter audit"
            loading={busy === 'audit'}
            onClick={() => void runExport('audit')}
          />

          <div className="rounded-lg border border-st-border bg-st-card p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-st-gold/10 text-st-gold">
                <Download size={17} />
              </span>
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-st-dim">
                  Tip pool
                </p>
                <h2 className="mt-0.5 text-[15px] font-medium text-st-hi">Tip pool PDF</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-st-sec">
                  Requiert un shiftId. Le chemin le plus simple est d’exporter depuis la page de
                  distribution du shift.
                </p>
              </div>
            </div>
            <label className="mb-3 flex flex-col gap-1.5 text-[12px] text-st-sec">
              Shift ID
              <input
                type="text"
                value={shiftId}
                onChange={(event) => setShiftId(event.target.value)}
                placeholder="UUID du shift fermé"
                className="rounded-md border border-st-border bg-st-raised px-3 py-2 text-[12.5px] text-st-hi outline-none placeholder:text-st-dim focus:border-st-indigo"
              />
            </label>
            <button
              type="button"
              onClick={() => void runExport('tipPool')}
              disabled={busy === 'tipPool'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-st-border bg-st-raised px-3 py-2 text-[12.5px] font-medium text-st-hi transition-colors hover:bg-st-border disabled:cursor-wait disabled:opacity-60"
            >
              <Download size={14} />
              {busy === 'tipPool' ? 'Export…' : 'Exporter PDF'}
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-st-border bg-st-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={17} className="mt-0.5 text-st-emerald-glow" />
            <div>
              <h2 className="text-[15px] font-medium text-st-hi">Audit & compliance</h2>
              <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-st-sec">
                L’audit est disponible sous forme d’export CSV. Utilisez l’export audit pour obtenir
                les événements sensibles, distributions et exports sur la période choisie.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ExportCard({
  icon,
  eyebrow,
  title,
  description,
  buttonLabel,
  loading,
  onClick,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-st-border bg-st-card p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-st-indigo/10 text-st-indigo-glow">
          {icon}
        </span>
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-st-dim">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-[15px] font-medium text-st-hi">{title}</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-st-sec">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-st-border bg-st-raised px-3 py-2 text-[12.5px] font-medium text-st-hi transition-colors hover:bg-st-border disabled:cursor-wait disabled:opacity-60"
      >
        <Download size={14} />
        {loading ? 'Export…' : buttonLabel}
      </button>
    </div>
  );
}
