'use client';

import { useEffect, useState } from 'react';
import { Check, UserCheck, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { cn } from '../../../lib/cn';
import {
  fmtHours,
  fmtMoneyShort,
  fmtPercent,
  fmtRole,
  fmtShiftDateShort,
  fmtShiftType,
} from '../../employee/utils/employee-formatters';
import type {
  ManagerDispute,
  ResolveDisputePayload,
  TipDisputeOutcome,
} from '../types/dispute.types';
import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_OUTCOME_DESCRIPTIONS,
  DISPUTE_OUTCOME_LABELS,
  DISPUTE_STATUS_CONFIG,
} from '../utils/dispute-labels';

const MIN_NOTE = 5;
const MAX_NOTE = 1000;

const OUTCOMES: TipDisputeOutcome[] = ['EXPLAINED', 'MANUAL_FOLLOW_UP'];

const COMPUTATION_LABELS: Record<string, string> = {
  RULES: 'Règles',
  ML_ASSISTED: 'ML assisté',
  ML_FULL: 'ML complet',
  MANUAL_OVERRIDE: 'Ajustement manuel',
};

interface EvidenceEntry {
  label: string;
  value: string;
}

/** Évidences lisibles depuis le snapshot immuable (déjà redacté côté backend). */
function buildEvidence(dispute: ManagerDispute): EvidenceEntry[] {
  const snapshot = dispute.evidenceSnapshot;
  const entries: EvidenceEntry[] = [
    { label: 'Service', value: fmtShiftType(snapshot.shiftType) },
    { label: 'Date du shift', value: fmtShiftDateShort(snapshot.shiftDate) },
    { label: 'Montant reçu', value: fmtMoneyShort(snapshot.amount) },
  ];

  if (snapshot.roleDuringShift) {
    entries.push({ label: 'Rôle', value: fmtRole(snapshot.roleDuringShift) });
  }
  if (snapshot.hoursWorked) {
    entries.push({ label: 'Heures', value: fmtHours(snapshot.hoursWorked) });
  }
  if (snapshot.explanation?.scoreShare) {
    entries.push({ label: 'Part du pool', value: fmtPercent(snapshot.explanation.scoreShare) });
  }
  entries.push({
    label: 'Méthode',
    value: COMPUTATION_LABELS[snapshot.computationMethod] ?? snapshot.computationMethod,
  });
  entries.push({
    label: 'Capturé le',
    value: format(new Date(snapshot.capturedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr }),
  });

  return entries;
}

interface DisputeDetailDrawerProps {
  dispute: ManagerDispute | null;
  onClose: () => void;
  onStartReview: (id: string) => Promise<unknown>;
  onResolve: (id: string, payload: ResolveDisputePayload) => Promise<unknown>;
  reviewing: boolean;
  resolving: boolean;
}

export function DisputeDetailDrawer({
  dispute,
  onClose,
  onStartReview,
  onResolve,
  reviewing,
  resolving,
}: DisputeDetailDrawerProps) {
  const [outcome, setOutcome] = useState<TipDisputeOutcome>('EXPLAINED');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);

  // Réinitialise le formulaire de résolution à chaque changement de litige.
  useEffect(() => {
    setOutcome('EXPLAINED');
    setNote('');
    setTouched(false);
  }, [dispute?.id]);

  useEffect(() => {
    if (!dispute) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dispute, onClose]);

  if (!dispute) return null;

  const status = DISPUTE_STATUS_CONFIG[dispute.status];
  const evidence = buildEvidence(dispute);
  const isOpen = dispute.status === 'OPEN';
  const canResolve = dispute.status === 'OPEN' || dispute.status === 'IN_REVIEW';
  const trimmedNote = note.trim();
  const noteTooShort = trimmedNote.length < MIN_NOTE;
  const showNoteError = touched && noteTooShort;
  const employeeName = `${dispute.employee.firstName} ${dispute.employee.lastName}`;

  const handleResolve = async () => {
    setTouched(true);
    if (noteTooShort) return;

    await onResolve(dispute.id, { outcome, resolutionNote: trimmedNote.slice(0, MAX_NOTE) });
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'color-mix(in srgb, var(--st-bg) 55%, transparent)',
          zIndex: 40,
        }}
        aria-hidden="true"
      />

      {/* Panneau */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-drawer-title"
        className="w-full sm:w-[460px]"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          maxWidth: '100vw',
          background: 'var(--st-card)',
          borderLeft: '1px solid var(--st-border)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* En-tête */}
        <div
          className="px-5 pt-5 pb-4 border-b border-st-border shrink-0"
          style={{ background: `linear-gradient(135deg, ${status.bg}, transparent)` }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <span
              className="px-2 py-0.5 rounded-pill text-[10px] font-mono uppercase tracking-[0.05em] border"
              style={{ color: status.color, background: status.bg, borderColor: status.border }}
            >
              {status.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-1 rounded-[6px] transition-colors hover:bg-st-raised"
              style={{ color: 'var(--st-dim)', background: 'transparent', border: 'none' }}
            >
              <X size={16} />
            </button>
          </div>
          <h2
            id="dispute-drawer-title"
            className="text-[16px] font-medium leading-snug"
            style={{ color: 'var(--st-hi)' }}
          >
            {employeeName} · {DISPUTE_CATEGORY_LABELS[dispute.category]}
          </h2>
          <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--st-sec)' }}>
            {fmtShiftType(dispute.evidenceSnapshot.shiftType)} du{' '}
            {fmtShiftDateShort(dispute.evidenceSnapshot.shiftDate)} · ouverte le{' '}
            {format(new Date(dispute.createdAt), 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Question de l'employé */}
          <section className="mb-5">
            <p
              className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium mb-2.5"
              style={{ color: 'var(--st-dim)' }}
            >
              Question de l&apos;employé
            </p>
            <div className="rounded-[10px] border border-st-border bg-st-raised p-3.5">
              <p
                className="text-[12.5px] leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--st-pri)' }}
              >
                {dispute.message}
              </p>
            </div>
          </section>

          {/* Snapshot d'évidence */}
          <section className="mb-5">
            <p
              className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium mb-2.5"
              style={{ color: 'var(--st-dim)' }}
            >
              Évidence au moment de la demande
            </p>
            <div className="rounded-[10px] border border-st-border overflow-hidden bg-st-raised">
              {evidence.map((entry, i) => (
                <div
                  key={entry.label}
                  className="grid items-center px-3.5 py-2.5"
                  style={{
                    gridTemplateColumns: '130px 1fr',
                    borderBottom: i === evidence.length - 1 ? 'none' : '1px solid var(--st-border)',
                  }}
                >
                  <span className="text-[11px]" style={{ color: 'var(--st-dim)' }}>
                    {entry.label}
                  </span>
                  <span className="text-[12.5px]" style={{ color: 'var(--st-pri)' }}>
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10.5px] mt-1.5" style={{ color: 'var(--st-dim)' }}>
              Copie immuable capturée à l&apos;ouverture. La résolution ne modifie aucun montant.
            </p>
          </section>

          {/* Résolution */}
          {canResolve ? (
            <section>
              <p
                className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium mb-2.5"
                style={{ color: 'var(--st-dim)' }}
              >
                Résolution
              </p>

              {/* Issue */}
              <div className="flex flex-col gap-2 mb-3" role="radiogroup" aria-label="Issue">
                {OUTCOMES.map((value) => {
                  const active = outcome === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setOutcome(value)}
                      className={cn(
                        'text-left rounded-[10px] border p-3 transition-colors cursor-pointer',
                        active ? 'border-st-indigo/50' : 'border-st-border hover:border-st-muted',
                      )}
                      style={{
                        background: active ? 'rgba(99,102,241,.08)' : 'transparent',
                        fontFamily: 'inherit',
                      }}
                    >
                      <p className="text-[12.5px] font-medium" style={{ color: 'var(--st-hi)' }}>
                        {DISPUTE_OUTCOME_LABELS[value]}
                      </p>
                      <p
                        className="text-[11px] mt-0.5 leading-relaxed"
                        style={{ color: 'var(--st-sec)' }}
                      >
                        {DISPUTE_OUTCOME_DESCRIPTIONS[value]}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Note obligatoire */}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => setTouched(true)}
                maxLength={MAX_NOTE}
                rows={3}
                placeholder="Note de résolution (obligatoire, visible par l'employé)…"
                className={cn(
                  'w-full rounded-[10px] border bg-st-raised p-3 text-[12.5px] resize-none focus:outline-none',
                  showNoteError ? 'border-st-danger/60' : 'border-st-border focus:border-st-muted',
                )}
                style={{ color: 'var(--st-hi)', fontFamily: 'inherit' }}
                aria-label="Note de résolution"
                aria-invalid={showNoteError}
              />
              {showNoteError && (
                <p className="text-[10.5px] mt-1" style={{ color: 'var(--st-danger)' }}>
                  La note de résolution est obligatoire (au moins {MIN_NOTE} caractères).
                </p>
              )}
            </section>
          ) : (
            <section>
              <p
                className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium mb-2.5"
                style={{ color: 'var(--st-dim)' }}
              >
                Résolution
              </p>
              <div className="rounded-[10px] border border-st-border bg-st-raised p-3.5">
                <p className="text-[12.5px] mb-1" style={{ color: 'var(--st-pri)' }}>
                  {status.label}
                  {dispute.resolvedAt
                    ? ` · ${format(new Date(dispute.resolvedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`
                    : ''}
                  {dispute.withdrawnAt
                    ? ` · ${format(new Date(dispute.withdrawnAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`
                    : ''}
                </p>
                {dispute.outcome && (
                  <p className="text-[12px] mb-1" style={{ color: 'var(--st-emerald-glow)' }}>
                    {DISPUTE_OUTCOME_LABELS[dispute.outcome]}
                  </p>
                )}
                <p
                  className="text-[12px] leading-relaxed whitespace-pre-wrap"
                  style={{
                    color: dispute.resolutionNote ? 'var(--st-sec)' : 'var(--st-muted)',
                    fontStyle: dispute.resolutionNote ? 'normal' : 'italic',
                  }}
                >
                  {dispute.resolutionNote ?? 'Aucune note.'}
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Pied : actions */}
        {canResolve && (
          <div className="border-t border-st-border px-5 py-3.5 flex items-center justify-end gap-2 shrink-0 bg-st-bg">
            {isOpen && (
              <button
                type="button"
                onClick={() => void onStartReview(dispute.id)}
                disabled={reviewing || resolving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] border border-st-border hover:bg-st-raised transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                style={{ color: 'var(--st-sec)', background: 'transparent', fontFamily: 'inherit' }}
              >
                <UserCheck size={13} /> {reviewing ? 'En cours…' : 'Prendre en charge'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleResolve()}
              disabled={reviewing || resolving || (touched && noteTooShort)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[12.5px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{
                color: '#fff',
                background: resolving ? '#3730A3' : '#6366F1',
                border: '1px solid transparent',
                fontFamily: 'inherit',
              }}
            >
              <Check size={13} /> {resolving ? 'En cours…' : 'Résoudre'}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
