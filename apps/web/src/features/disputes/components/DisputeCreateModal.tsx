'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { cn } from '../../../lib/cn';
import type { EmployeeShiftRecord } from '../../employee/types/employee.types';
import {
  fmtMoneyShort,
  fmtShiftDate,
  fmtShiftType,
} from '../../employee/utils/employee-formatters';
import type { CreateDisputePayload, TipDisputeCategory } from '../types/dispute.types';
import { DISPUTE_CATEGORY_LABELS } from '../utils/dispute-labels';

const CATEGORIES: TipDisputeCategory[] = ['AMOUNT', 'HOURS', 'ROLE', 'OTHER'];

const MIN_MESSAGE = 10;
const MAX_MESSAGE = 2000;

interface DisputeCreateModalProps {
  /** Entrée du portefeuille concernée. Null = modal fermée. */
  record: EmployeeShiftRecord | null;
  onClose: () => void;
  onSubmit: (payload: CreateDisputePayload) => Promise<unknown>;
  submitting: boolean;
}

/**
 * « Poser une question » sur une distribution (BIS-56).
 * Ouvre un litige documenté — n'affecte jamais le montant affiché.
 */
export function DisputeCreateModal({
  record,
  onClose,
  onSubmit,
  submitting,
}: DisputeCreateModalProps) {
  const [category, setCategory] = useState<TipDisputeCategory>('AMOUNT');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  // Réinitialise le formulaire à chaque ouverture.
  useEffect(() => {
    setCategory('AMOUNT');
    setMessage('');
    setTouched(false);
  }, [record?.id]);

  useEffect(() => {
    if (!record) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [record, onClose]);

  if (!record) return null;

  const trimmed = message.trim();
  const tooShort = trimmed.length < MIN_MESSAGE;
  const showError = touched && tooShort;

  const handleSubmit = async () => {
    setTouched(true);
    if (tooShort) return;

    await onSubmit({
      tipDistributionId: record.id,
      category,
      message: trimmed.slice(0, MAX_MESSAGE),
    });
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'color-mix(in srgb, var(--st-bg) 60%, transparent)',
          zIndex: 40,
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-create-title"
        className="w-[calc(100vw-2rem)] max-w-md"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--st-card)',
          border: '1px solid var(--st-border)',
          borderRadius: 14,
          zIndex: 50,
          maxHeight: 'calc(100vh - 4rem)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* En-tête */}
        <div className="px-5 pt-5 pb-4 border-b border-st-border flex items-start justify-between gap-3">
          <div>
            <h2 id="dispute-create-title" className="text-[16px] font-medium text-st-hi">
              Poser une question
            </h2>
            <p className="text-[11.5px] text-st-sec mt-1">
              {fmtShiftType(record.shiftType)} · {fmtShiftDate(record.date)} ·{' '}
              <span className="font-mono">{fmtMoneyShort(record.amount)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 rounded-[6px] text-st-dim hover:bg-st-raised transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <p className="text-[11.5px] text-st-dim leading-relaxed">
            Votre question sera transmise à votre gestionnaire avec une copie de votre calcul. Elle
            ne modifie pas votre montant.
          </p>

          {/* Catégorie */}
          <div>
            <p className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium text-st-dim mb-2">
              Catégorie
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Catégorie">
              {CATEGORIES.map((value) => {
                const active = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setCategory(value)}
                    className={cn(
                      'px-3 py-1.5 rounded-[8px] text-[12px] border transition-colors cursor-pointer',
                      active
                        ? 'border-st-indigo/50 text-st-hi'
                        : 'border-st-border text-st-sec hover:text-st-hi',
                    )}
                    style={{
                      background: active ? 'rgba(99,102,241,.12)' : 'transparent',
                      fontFamily: 'inherit',
                    }}
                  >
                    {DISPUTE_CATEGORY_LABELS[value]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <p className="uppercase tracking-[0.14em] font-mono text-[9.5px] font-medium text-st-dim mb-2">
              Votre question
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={MAX_MESSAGE}
              rows={4}
              placeholder="Décrivez votre question (heures, montant, rôle…)"
              className={cn(
                'w-full rounded-[10px] border bg-st-raised p-3 text-[12.5px] resize-none focus:outline-none',
                showError ? 'border-st-danger/60' : 'border-st-border focus:border-st-muted',
              )}
              style={{ color: 'var(--st-hi)', fontFamily: 'inherit' }}
              aria-label="Votre question"
              aria-invalid={showError}
            />
            <div className="flex items-center justify-between mt-1">
              <p
                className="text-[10.5px]"
                style={{ color: showError ? 'var(--st-danger)' : 'var(--st-dim)' }}
              >
                {showError ? `Au moins ${MIN_MESSAGE} caractères.` : ' '}
              </p>
              <p className="text-[10.5px] font-mono text-st-dim">
                {trimmed.length}/{MAX_MESSAGE}
              </p>
            </div>
          </div>
        </div>

        {/* Pied */}
        <div className="border-t border-st-border px-5 py-3.5 flex items-center justify-end gap-2 bg-st-bg">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3.5 py-2 rounded-[8px] text-[12.5px] border border-st-border text-st-sec hover:bg-st-raised transition-colors disabled:opacity-60 cursor-pointer"
            style={{ background: 'transparent', fontFamily: 'inherit' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || (touched && tooShort)}
            className="px-4 py-2 rounded-[8px] text-[12.5px] font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            style={{
              background: submitting ? '#3730A3' : '#6366F1',
              border: '1px solid transparent',
              fontFamily: 'inherit',
            }}
          >
            {submitting ? 'Envoi…' : 'Envoyer ma question'}
          </button>
        </div>
      </div>
    </>
  );
}
