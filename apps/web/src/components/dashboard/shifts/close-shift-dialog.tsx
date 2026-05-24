'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { lockScroll, unlockScroll } from '../../../lib/scroll-lock';
import { useCloseShift } from '../../../hooks/use-shifts';
import { useCreateTipPool } from '../../../hooks/use-tip-pools';
import type { Shift } from '../../../types/shift';
import type { TipPool } from '../../../types/tip-pool';

// ── Step config ────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'cash', label: 'Espèces', icon: '💵' },
  { key: 'card', label: 'Carte', icon: '💳' },
  { key: 'preview', label: 'Résumé', icon: '◉' },
  { key: 'seal', label: 'Clôture', icon: '✦' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

// ── Label style ────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--st-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontSize: 10,
  color: '#5A6485',
  fontWeight: 500,
  marginBottom: 6,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  background: '#0F1422',
  border: '1px solid #252D45',
  borderRadius: 6,
  padding: '9px 11px',
  color: '#F4F6FB',
  fontFamily: 'var(--st-font-mono)',
  fontSize: 15,
  outline: 'none',
  width: '100%',
  transition: 'border-color .15s ease, box-shadow .15s ease',
  boxSizing: 'border-box',
  fontVariantNumeric: 'tabular-nums',
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface CloseShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift;
  existingTipPool: TipPool | null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CloseShiftDialog({
  open,
  onOpenChange,
  shift,
  existingTipPool,
}: CloseShiftDialogProps) {
  const isLocked = shift.status === 'CLOSED';
  const submittingRef = useRef(false);
  // ROB-H1: mountedRef prevents async callbacks from setting state after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [step, setStep] = useState<number>(0);
  const [cashRaw, setCashRaw] = useState('');
  const [cardRaw, setCardRaw] = useState('');
  const [notes, setNotes] = useState('');
  const [rootError, setRootError] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [confirmedZero, setConfirmedZero] = useState(false);

  const closeShift = useCloseShift();
  const createTipPool = useCreateTipPool();
  const isPending = closeShift.isPending || createTipPool.isPending;

  const cash = parseFloat(cashRaw) || 0;
  const card = parseFloat(cardRaw) || 0;
  const total = (cash + card).toFixed(2);
  const isZeroPool = cash === 0 && card === 0;

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(0);
      setCashRaw('');
      setCardRaw('');
      setNotes('');
      setRootError('');
      setConfirmedZero(false);
      submittingRef.current = false;
    }
  }, [open]);

  // If there's already a tip pool, skip to step 3 (seal only)
  useEffect(() => {
    if (open && existingTipPool) setStep(3);
  }, [open, existingTipPool]);

  // Escape key + body scroll lock (reference-counted via scroll-lock.ts — ROB-H2)
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onOpenChange(false);
    };
    window.addEventListener('keydown', h);
    lockScroll();
    return () => {
      window.removeEventListener('keydown', h);
      unlockScroll();
    };
  }, [open, onOpenChange, isPending]);

  const handleSeal = () => {
    if (isLocked || submittingRef.current) return;
    submittingRef.current = true;
    setRootError('');

    closeShift.mutate(shift.id, {
      onSuccess: () => {
        if (existingTipPool) {
          onOpenChange(false);
          submittingRef.current = false;
          return;
        }
        createTipPool.mutate(
          {
            shiftId: shift.id,
            cashAmount: cash,
            cardAmount: card,
            ...(notes ? { notes } : {}),
          },
          {
            onSuccess: () => {
              // ROB-H1: guard against setting state after unmount
              if (!mountedRef.current) return;
              submittingRef.current = false;
              onOpenChange(false);
            },
            onError: (err: unknown) => {
              if (!mountedRef.current) return;
              const status = (err as { response?: { status?: number } })?.response?.status;
              if (status !== 409) {
                setRootError('Shift clôturé, mais erreur lors de la déclaration du pool.');
              } else {
                onOpenChange(false);
              }
              submittingRef.current = false;
            },
          },
        );
      },
      onError: () => {
        submittingRef.current = false;
      },
    });
  };

  if (!open) return null;

  // ── Step content ─────────────────────────────────────────────────────────────

  const stepContent = () => {
    if (existingTipPool && step === 3) {
      return (
        <div style={{ padding: '24px 24px 10px' }}>
          <div
            style={{
              padding: 14,
              background: 'rgba(99,102,241,.08)',
              border: '1px solid rgba(99,102,241,.25)',
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--st-font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#818CF8',
              }}
            >
              Pool déjà déclaré
            </span>
            <div style={{ marginTop: 10, display: 'flex', gap: 20 }}>
              <div>
                <span style={{ ...labelStyle, marginBottom: 2 }}>Espèces</span>
                <span
                  style={{
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 18,
                    color: '#F4F6FB',
                    fontWeight: 600,
                  }}
                >
                  {Number(existingTipPool.cashAmount).toFixed(2)} $
                </span>
              </div>
              <div>
                <span style={{ ...labelStyle, marginBottom: 2 }}>Carte</span>
                <span
                  style={{
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 18,
                    color: '#F4F6FB',
                    fontWeight: 600,
                  }}
                >
                  {Number(existingTipPool.cardAmount).toFixed(2)} $
                </span>
              </div>
              <div>
                <span style={{ ...labelStyle, marginBottom: 2 }}>Total</span>
                <span
                  style={{
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 18,
                    color: '#34D399',
                    fontWeight: 600,
                  }}
                >
                  {(
                    Number(existingTipPool.cashAmount) + Number(existingTipPool.cardAmount)
                  ).toFixed(2)}{' '}
                  $
                </span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#8892B0', fontFamily: 'var(--st-font-ui)' }}>
            Un pool a déjà été déclaré. Seule la clôture du shift sera effectuée.
          </p>
        </div>
      );
    }

    switch (step) {
      case 0:
        return (
          <div style={{ padding: '24px 24px 10px' }}>
            <p
              style={{
                fontSize: 13,
                color: '#8892B0',
                fontFamily: 'var(--st-font-ui)',
                marginBottom: 18,
              }}
            >
              Saisissez le montant total des pourboires reçus en{' '}
              <strong style={{ color: '#D4A574' }}>espèces</strong> pendant ce service.
            </p>
            <label style={labelStyle}>Espèces ($)</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#5A6485',
                  fontFamily: 'var(--st-font-mono)',
                  fontSize: 14,
                  pointerEvents: 'none',
                }}
              >
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="99999.99"
                placeholder="0.00"
                value={cashRaw}
                onChange={(e) => setCashRaw(e.target.value)}
                onFocus={() => setFocusedInput('cash')}
                onBlur={() => setFocusedInput(null)}
                style={{
                  ...inputStyle,
                  paddingLeft: 22,
                  borderColor: focusedInput === 'cash' ? '#D4A574' : '#252D45',
                  boxShadow: focusedInput === 'cash' ? '0 0 0 3px rgba(212,165,116,.15)' : 'none',
                  fontSize: 22,
                }}
                autoFocus
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div style={{ padding: '24px 24px 10px' }}>
            <p
              style={{
                fontSize: 13,
                color: '#8892B0',
                fontFamily: 'var(--st-font-ui)',
                marginBottom: 18,
              }}
            >
              Saisissez le montant des pourboires reçus par{' '}
              <strong style={{ color: '#818CF8' }}>carte bancaire</strong>.
            </p>
            <label style={labelStyle}>Carte ($)</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#5A6485',
                  fontFamily: 'var(--st-font-mono)',
                  fontSize: 14,
                  pointerEvents: 'none',
                }}
              >
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="99999.99"
                placeholder="0.00"
                value={cardRaw}
                onChange={(e) => setCardRaw(e.target.value)}
                onFocus={() => setFocusedInput('card')}
                onBlur={() => setFocusedInput(null)}
                style={{
                  ...inputStyle,
                  paddingLeft: 22,
                  borderColor: focusedInput === 'card' ? '#818CF8' : '#252D45',
                  boxShadow: focusedInput === 'card' ? '0 0 0 3px rgba(99,102,241,.15)' : 'none',
                  fontSize: 22,
                }}
                autoFocus
              />
            </div>
            {/* Back hint */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#5A6485', fontFamily: 'var(--st-font-mono)' }}>
                Espèces :
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: '#D4A574',
                  fontFamily: 'var(--st-font-mono)',
                  fontWeight: 600,
                }}
              >
                {cash.toFixed(2)} $
              </span>
            </div>
          </div>
        );
      case 2:
        return (
          <div style={{ padding: '24px 24px 10px' }}>
            <p
              style={{
                fontSize: 13,
                color: '#8892B0',
                fontFamily: 'var(--st-font-ui)',
                marginBottom: 16,
              }}
            >
              Vérifiez le récapitulatif avant de sceller le service.
            </p>
            {/* Summary tiles */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
                marginBottom: 16,
              }}
            >
              {[
                {
                  label: 'Espèces',
                  value: `${cash.toFixed(2)} $`,
                  color: '#D4A574',
                  bg: 'rgba(212,165,116,.08)',
                },
                {
                  label: 'Carte',
                  value: `${card.toFixed(2)} $`,
                  color: '#818CF8',
                  bg: 'rgba(99,102,241,.08)',
                },
                {
                  label: 'Total',
                  value: `${total} $`,
                  color: '#34D399',
                  bg: 'rgba(52,211,153,.08)',
                },
              ].map(({ label, value, color, bg }) => (
                <div
                  key={label}
                  style={{
                    background: bg,
                    border: `1px solid ${color}30`,
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ ...labelStyle, color, marginBottom: 4 }}>{label}</div>
                  <div
                    style={{
                      fontFamily: 'var(--st-font-mono)',
                      fontSize: 18,
                      color: '#F4F6FB',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
            {/* Notes */}
            {/* SEC-H3: maxLength prevents excessively large payloads */}
            <label htmlFor="close-shift-notes" style={labelStyle}>
              Notes (optionnel)
            </label>
            <textarea
              id="close-shift-notes"
              rows={2}
              placeholder="Observations sur le pool…"
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              onFocus={() => setFocusedInput('notes')}
              onBlur={() => setFocusedInput(null)}
              style={{
                ...inputStyle,
                fontFamily: 'var(--st-font-ui)',
                fontSize: 13,
                resize: 'vertical',
                lineHeight: 1.5,
                borderColor: focusedInput === 'notes' ? '#6366F1' : '#252D45',
                boxShadow: focusedInput === 'notes' ? '0 0 0 3px rgba(99,102,241,.15)' : 'none',
              }}
            />
            {/* Zero-pool warning (QUAL-C2) */}
            {isZeroPool && (
              // QUAL-L5: explicit htmlFor/id pairing for better accessibility tooling support
              <label
                htmlFor="confirm-zero-pool"
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  marginTop: 14,
                  cursor: 'pointer',
                  padding: '10px 12px',
                  background: 'rgba(245,158,11,.06)',
                  border: '1px solid rgba(245,158,11,.25)',
                  borderRadius: 8,
                }}
              >
                <input
                  id="confirm-zero-pool"
                  type="checkbox"
                  checked={confirmedZero}
                  onChange={(e) => setConfirmedZero(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: '#F59E0B',
                    fontFamily: 'var(--st-font-ui)',
                    lineHeight: 1.5,
                  }}
                >
                  ⚠ Total de 0,00 $ — confirmer qu&apos;aucun pourboire n&apos;a été déclaré pour ce
                  service.
                </span>
              </label>
            )}
          </div>
        );
      case 3:
        return (
          <div style={{ padding: '28px 24px 10px', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(99,102,241,.12)',
                border: '1px solid rgba(99,102,241,.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#818CF8"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <path d="m3.29 7 8.71 5 8.71-5M12 22V12" />
              </svg>
            </div>
            <h3
              style={{
                fontSize: 20,
                color: '#F4F6FB',
                fontFamily: 'var(--st-font-display)',
                marginBottom: 8,
                lineHeight: 1.2,
              }}
            >
              Prêt à sceller le service
            </h3>
            <p
              style={{
                fontSize: 13,
                color: '#8892B0',
                fontFamily: 'var(--st-font-ui)',
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Le shift sera marqué <strong style={{ color: '#34D399' }}>Clôturé</strong> et le pool
              de pourboires déclaré. Cette action est irréversible.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 20,
                padding: '12px 0',
                borderTop: '1px dashed #1B2236',
                borderBottom: '1px dashed #1B2236',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...labelStyle, marginBottom: 2, textAlign: 'center' }}>Espèces</div>
                <span style={{ fontFamily: 'var(--st-font-mono)', fontSize: 16, color: '#D4A574' }}>
                  {cash.toFixed(2)} $
                </span>
              </div>
              <div style={{ width: 1, background: '#1B2236' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...labelStyle, marginBottom: 2, textAlign: 'center' }}>Carte</div>
                <span style={{ fontFamily: 'var(--st-font-mono)', fontSize: 16, color: '#818CF8' }}>
                  {card.toFixed(2)} $
                </span>
              </div>
              <div style={{ width: 1, background: '#1B2236' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...labelStyle, marginBottom: 2, textAlign: 'center' }}>Total</div>
                <span style={{ fontFamily: 'var(--st-font-mono)', fontSize: 16, color: '#34D399' }}>
                  {total} $
                </span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const currentStepCount = existingTipPool ? 3 : STEPS.length;
  const currentStepIndex = existingTipPool ? 3 : step;

  const canGoNext = step < (existingTipPool ? 3 : STEPS.length - 1);
  const isLastStep = step === (existingTipPool ? 3 : STEPS.length - 1);

  return (
    <div
      onClick={() => {
        if (!isPending) onOpenChange(false);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,7,15,.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="shifts-fade-up"
        style={{
          width: 480,
          maxWidth: '100%',
          background: '#0F1422',
          border: '1px solid #252D45',
          borderRadius: 14,
          boxShadow: '0 24px 60px -20px rgba(0,0,0,.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 16px',
            borderBottom: '1px solid #1B2236',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>
              {existingTipPool
                ? 'Clôture du shift'
                : `Étape ${currentStepIndex + 1} / ${currentStepCount} — ${STEPS[currentStepIndex]?.label}`}
            </div>
            <h2
              id="dialog-title"
              className="font-display"
              style={{ fontSize: 22, color: '#F4F6FB', margin: 0, lineHeight: 1.15 }}
            >
              Clôturer le service
            </h2>
          </div>
          <button
            onClick={() => {
              if (!isPending) onOpenChange(false);
            }}
            disabled={isPending}
            style={{
              background: 'transparent',
              border: 0,
              color: '#8892B0',
              cursor: isPending ? 'not-allowed' : 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Step content */}
        <div style={{ flex: 1 }}>{stepContent()}</div>

        {/* Error */}
        {rootError && (
          <div
            style={{
              margin: '0 24px 10px',
              padding: '10px 12px',
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.25)',
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 12, color: '#EF4444', fontFamily: 'var(--st-font-ui)' }}>
              {rootError}
            </span>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #1B2236',
            background: '#0A0E1A',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {/* Step dots */}
          {!existingTipPool && (
            <div style={{ flex: 1, display: 'flex', gap: 5, alignItems: 'center' }}>
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`shifts-step-dot${i < step ? ' done' : i === step ? ' active' : ''}`}
                />
              ))}
            </div>
          )}
          {existingTipPool && <div style={{ flex: 1 }} />}

          {/* Back button */}
          {step > 0 && !existingTipPool && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={isPending}
              style={{
                background: 'transparent',
                border: '1px solid #252D45',
                borderRadius: 10,
                padding: '7px 14px',
                color: '#8892B0',
                fontSize: 12,
                fontFamily: 'var(--st-font-ui)',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              ← Retour
            </button>
          )}

          {/* Cancel */}
          <button
            type="button"
            onClick={() => {
              if (!isPending) onOpenChange(false);
            }}
            disabled={isPending}
            style={{
              background: 'transparent',
              border: '1px solid #252D45',
              borderRadius: 10,
              padding: '7px 14px',
              color: '#F4F6FB',
              fontSize: 12,
              fontFamily: 'var(--st-font-ui)',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            Annuler
          </button>

          {/* Next / Seal */}
          {canGoNext && !existingTipPool ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              // ROB-M4: block advancing past step 2 when pool is zero and not confirmed
              disabled={step === 2 && isZeroPool && !confirmedZero}
              style={{
                background: step === 2 && isZeroPool && !confirmedZero ? '#1B2236' : '#1B2236',
                border: '1px solid #252D45',
                borderRadius: 10,
                padding: '7px 14px',
                color: step === 2 && isZeroPool && !confirmedZero ? '#3A4366' : '#F4F6FB',
                fontSize: 12,
                fontFamily: 'var(--st-font-ui)',
                cursor: step === 2 && isZeroPool && !confirmedZero ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all .15s ease',
                opacity: step === 2 && isZeroPool && !confirmedZero ? 0.5 : 1,
              }}
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSeal}
              disabled={isLocked || isPending || (isZeroPool && !confirmedZero && !existingTipPool)}
              style={{
                background:
                  isLocked || isPending || (isZeroPool && !confirmedZero && !existingTipPool)
                    ? '#4F46E5'
                    : '#6366F1',
                border: '1px solid transparent',
                borderRadius: 10,
                padding: '7px 16px',
                color: 'white',
                fontSize: 12,
                fontFamily: 'var(--st-font-ui)',
                cursor:
                  isLocked || isPending || (isZeroPool && !confirmedZero && !existingTipPool)
                    ? 'not-allowed'
                    : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                opacity:
                  isLocked || isPending || (isZeroPool && !confirmedZero && !existingTipPool)
                    ? 0.75
                    : 1,
                transition: 'all .15s ease',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)',
              }}
            >
              {isPending ? (
                <>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Clôture…
                </>
              ) : (
                <>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Sceller le service
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
