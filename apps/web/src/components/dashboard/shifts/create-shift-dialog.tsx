'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { lockScroll, unlockScroll } from '../../../lib/scroll-lock';
import { SHIFT_TYPES, type ShiftType } from '../../../types/shift';
import { SHIFT_TYPE_CFG } from './shift-type-chip';

// ── Schema ─────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
    shiftType: z.enum(SHIFT_TYPES, { required_error: 'Type de shift requis' }),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure de début invalide (HH:MM)'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure de fin invalide (HH:MM)'),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (d) => {
      const [sh, sm] = d.startTime.split(':').map(Number);
      const [eh, em] = d.endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      // Allow overnight shifts (end < start) but block identical times
      return startMins !== endMins;
    },
    { message: 'Les heures de début et de fin ne peuvent pas être identiques', path: ['endTime'] },
  );

export type ShiftFormValues = z.infer<typeof schema>;

// ── Duration label helper ──────────────────────────────────────────────────────

function durationLabel(start: string, end: string): string {
  if (!start || !end) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m ? ` ${m}min` : ''}`;
}

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
  fontFamily: 'var(--st-font-ui)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  transition: 'border-color .15s ease, box-shadow .15s ease',
  boxSizing: 'border-box',
};

// ── Props ──────────────────────────────────────────────────────────────────────

export interface CreateShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ShiftFormValues) => void;
  loading?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in LOCAL time (not UTC).
 *  new Date().toISOString() is UTC-based and shifts the date by ±1 day
 *  for timezones that are UTC- (e.g. UTC-4 at 22:00 local = next day UTC).
 */
function getLocalToday(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function CreateShiftDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
}: CreateShiftDialogProps) {
  const today = getLocalToday();
  const submittingRef = useRef(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today,
      shiftType: 'DINNER',
      startTime: '17:00',
      endTime: '23:00',
      notes: '',
    },
  });

  const watchedType = watch('shiftType');
  const watchedStart = watch('startTime');
  const watchedEnd = watch('endTime');

  useEffect(() => {
    if (!open) {
      reset({ date: today, shiftType: 'DINNER', startTime: '17:00', endTime: '23:00', notes: '' });
      submittingRef.current = false;
    } else if (!loading) {
      submittingRef.current = false;
    }
  }, [open, loading, reset, today]);

  // Trap Escape + body scroll lock (reference-counted via scroll-lock.ts — ROB-H2)
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', h);
    lockScroll();
    return () => {
      window.removeEventListener('keydown', h);
      unlockScroll();
    };
  }, [open, onOpenChange]);

  const handleFormSubmit = (data: ShiftFormValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    onSubmit(data);
  };

  if (!open) return null;

  return (
    <div
      onClick={() => onOpenChange(false)}
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
          width: 600,
          maxWidth: '100%',
          maxHeight: '90vh',
          background: '#0F1422',
          border: '1px solid #252D45',
          borderRadius: 14,
          boxShadow: '0 24px 60px -20px rgba(0,0,0,.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: '20px 24px 18px',
            borderBottom: '1px solid #1B2236',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Nouveau shift</div>
            <h2
              id="dialog-title"
              className="font-display"
              style={{ fontSize: 24, color: '#F4F6FB', margin: 0, lineHeight: 1.15 }}
            >
              Préparer un service
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              background: 'transparent',
              border: 0,
              color: '#8892B0',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#141A2B';
              (e.currentTarget as HTMLButtonElement).style.color = '#F4F6FB';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#8892B0';
            }}
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1 }}>
          <form onSubmit={handleSubmit(handleFormSubmit)} noValidate id="create-shift-form">
            {/* Service type visual picker */}
            <label style={labelStyle}>Type de service</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginBottom: 18,
              }}
            >
              {SHIFT_TYPES.map((key) => {
                const cfg = SHIFT_TYPE_CFG[key];
                const isSelected = watchedType === key;
                return (
                  <label key={key}>
                    <input
                      type="radio"
                      value={key}
                      {...register('shiftType')}
                      style={{ display: 'none' }}
                    />
                    <div
                      className={cfg.cssClass}
                      style={{
                        padding: '14px 10px',
                        borderRadius: 10,
                        background: isSelected ? 'var(--type-g)' : '#141A2B',
                        border: `1px solid ${isSelected ? 'var(--type-c)' : '#252D45'}`,
                        color: isSelected ? 'var(--type-c)' : '#8892B0',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        transition: 'all .15s ease',
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{cfg.icon}</span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: isSelected ? 'var(--type-c)' : '#F4F6FB',
                        }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontFamily: 'var(--st-font-mono)',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {cfg.shortLabel}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.shiftType && (
              <p style={{ fontSize: 11.5, color: '#EF4444', marginBottom: 12, marginTop: -12 }}>
                {errors.shiftType.message}
              </p>
            )}

            {/* Date + times */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 14,
                marginBottom: 18,
              }}
            >
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  {...register('date')}
                  type="date"
                  style={{
                    ...inputStyle,
                    borderColor:
                      focusedInput === 'date' ? '#6366F1' : errors.date ? '#EF4444' : '#252D45',
                    boxShadow: focusedInput === 'date' ? '0 0 0 3px rgba(99,102,241,.18)' : 'none',
                  }}
                  onFocus={() => setFocusedInput('date')}
                  onBlur={() => setFocusedInput(null)}
                />
                {errors.date && (
                  <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>
                    {errors.date.message}
                  </p>
                )}
              </div>
              <div>
                <label style={labelStyle}>Début</label>
                <input
                  {...register('startTime')}
                  type="time"
                  style={{
                    ...inputStyle,
                    borderColor:
                      focusedInput === 'start'
                        ? '#6366F1'
                        : errors.startTime
                          ? '#EF4444'
                          : '#252D45',
                    boxShadow: focusedInput === 'start' ? '0 0 0 3px rgba(99,102,241,.18)' : 'none',
                  }}
                  onFocus={() => setFocusedInput('start')}
                  onBlur={() => setFocusedInput(null)}
                />
                {errors.startTime && (
                  <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>
                    {errors.startTime.message}
                  </p>
                )}
              </div>
              <div>
                <label style={labelStyle}>Fin</label>
                <input
                  {...register('endTime')}
                  type="time"
                  style={{
                    ...inputStyle,
                    borderColor:
                      focusedInput === 'end' ? '#6366F1' : errors.endTime ? '#EF4444' : '#252D45',
                    boxShadow: focusedInput === 'end' ? '0 0 0 3px rgba(99,102,241,.18)' : 'none',
                  }}
                  onFocus={() => setFocusedInput('end')}
                  onBlur={() => setFocusedInput(null)}
                />
                {errors.endTime && (
                  <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>
                    {errors.endTime.message}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <label style={labelStyle}>Notes (optionnel)</label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Ex: réservation privée, anniversaire…"
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: 1.5,
                borderColor: focusedInput === 'notes' ? '#6366F1' : '#252D45',
                boxShadow: focusedInput === 'notes' ? '0 0 0 3px rgba(99,102,241,.18)' : 'none',
              }}
              onFocus={() => setFocusedInput('notes')}
              onBlur={() => setFocusedInput(null)}
            />
            {errors.notes && (
              <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{errors.notes.message}</p>
            )}

            {/* Duration hint */}
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: '#141A2B',
                borderRadius: 10,
                border: '1px solid #1B2236',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8892B0"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <div style={{ fontSize: 12, color: '#8892B0' }}>
                Durée —{' '}
                <span style={{ fontFamily: 'var(--st-font-mono)', color: '#F4F6FB' }}>
                  {durationLabel(watchedStart, watchedEnd)}
                </span>
              </div>
            </div>
          </form>
        </div>

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
          <span style={{ fontSize: 11.5, color: '#5A6485', flex: 1 }}>
            Une fois créé, vous pourrez assigner l&apos;équipe.
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            style={{
              background: 'transparent',
              border: '1px solid #252D45',
              borderRadius: 10,
              padding: '7px 14px',
              color: '#F4F6FB',
              fontSize: 12,
              fontFamily: 'var(--st-font-ui)',
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="create-shift-form"
            disabled={loading}
            style={{
              background: loading ? '#4F46E5' : '#6366F1',
              border: '1px solid transparent',
              borderRadius: 10,
              padding: '7px 14px',
              color: 'white',
              fontSize: 12,
              fontFamily: 'var(--st-font-ui)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              opacity: loading ? 0.75 : 1,
              transition: 'all .15s ease',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {loading ? 'Création…' : 'Créer le shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
