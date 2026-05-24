'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sparkles, QrCode, Mail, Clock } from 'lucide-react';
import { z } from 'zod';
import type { EmployeeRole, CreateEmployeePayload } from '../../../types/employee';
import { EMPLOYEE_ROLES } from '../../../types/employee';
// Use shared role config instead of per-file duplicates (ARCH-C1 / QUAL-H6)
import { ROLE_CONFIG, ROLE_ORDER } from '../../../config/employee-roles';

// SEC-M2: Minimum ms between two valid submit attempts (prevents rapid-fire)
const SUBMIT_COOLDOWN_MS = 2000;

// ── Form validation ──────────────────────────────────────────
const inviteSchema = z.object({
  firstName: z.string().min(2, 'Min 2 caractères').max(100),
  lastName: z.string().min(2, 'Min 2 caractères').max(100),
  email: z.string().email('Email invalide').max(254),
  role: z.enum(EMPLOYEE_ROLES, { required_error: 'Rôle requis' }),
  hourlyWage: z.coerce.number({ invalid_type_error: 'Montant invalide' }).min(0).max(200),
  coefficient: z.coerce.number().min(0).max(10).optional(),
  // SEC-L3: validate date format + reject future dates
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis')
    .refine((d) => {
      const date = new Date(d + 'T12:00:00');
      return !isNaN(date.getTime()) && date <= new Date();
    }, "La date d'embauche ne peut pas être dans le futur"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateEmployeePayload) => void;
  loading?: boolean;
}

const EMPTY_FORM: InviteFormData = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'SERVER',
  hourlyWage: 16.5,
  coefficient: 1,
  hireDate: '',
};

export function InviteModal({ open, onClose, onSubmit, loading = false }: InviteModalProps) {
  const [mode, setMode] = useState<'email' | 'qr'>('email');
  const [form, setForm] = useState<InviteFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof InviteFormData, string>>>({});
  // SEC-M2: track last successful submit timestamp for cooldown
  const lastSubmitRef = useRef<number>(0);
  const firstInputRef = useRef<HTMLInputElement>(null);
  // ROB-H4: keep focus-timeout id for cleanup
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setMode('email');
      focusTimerRef.current = setTimeout(() => firstInputRef.current?.focus(), 80);
    }
    return () => {
      // ROB-H4: always clean up focus timer
      if (focusTimerRef.current !== null) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const set = useCallback(<K extends keyof InviteFormData>(k: K, v: InviteFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const next = { ...e };
      delete next[k];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    // SEC-M2: cooldown check — prevent double-submit / brute-force invites
    const now = Date.now();
    if (now - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) return;

    const result = inviteSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof InviteFormData, string>> = {};
      result.error.errors.forEach((e) => {
        const key = e.path[0] as keyof InviteFormData;
        if (!fieldErrors[key]) fieldErrors[key] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    lastSubmitRef.current = now;

    const payload: CreateEmployeePayload = {
      firstName: result.data.firstName,
      lastName: result.data.lastName,
      email: result.data.email,
      role: result.data.role,
      hourlyWage: result.data.hourlyWage,
      hireDate: result.data.hireDate,
      coefficient: result.data.coefficient ?? 1,
    };
    onSubmit(payload);
  }, [form, onSubmit]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,14,26,.65)',
          zIndex: 60,
        }}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)',
          background: '#0F1422',
          borderRadius: 16,
          border: '1px solid #1B2236',
          zIndex: 70,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1B2236', flexShrink: 0 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2
              id="invite-title"
              style={{ fontSize: 16, fontWeight: 700, color: '#F4F6FB', margin: 0 }}
            >
              Inviter un employé
            </h2>
            <button
              onClick={onClose}
              aria-label="Fermer"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#5A6485',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setMode('email')}
              className={`team-tab${mode === 'email' ? ' active' : ''}`}
            >
              <Mail size={12} />
              Email
            </button>
            <button
              onClick={() => setMode('qr')}
              className={`team-tab${mode === 'qr' ? ' active' : ''}`}
            >
              <QrCode size={12} />
              QR Code
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {mode === 'email' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Name row */}
              <div
                className="invite-form-double"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
              >
                <Field label="Prénom" error={errors.firstName}>
                  <input
                    ref={firstInputRef}
                    className="team-editable"
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="Camille"
                    maxLength={100}
                    style={{
                      border: `1px solid ${errors.firstName ? 'rgba(239,68,68,.5)' : '#1B2236'}`,
                      borderRadius: 8,
                    }}
                    aria-required="true"
                  />
                </Field>
                <Field label="Nom" error={errors.lastName}>
                  <input
                    className="team-editable"
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Pereira"
                    maxLength={100}
                    style={{
                      border: `1px solid ${errors.lastName ? 'rgba(239,68,68,.5)' : '#1B2236'}`,
                      borderRadius: 8,
                    }}
                    aria-required="true"
                  />
                </Field>
              </div>

              {/* Email */}
              <Field label="Email" error={errors.email}>
                <input
                  className="team-editable"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="camille@restaurant.com"
                  maxLength={254}
                  style={{
                    border: `1px solid ${errors.email ? 'rgba(239,68,68,.5)' : '#1B2236'}`,
                    borderRadius: 8,
                  }}
                  aria-required="true"
                />
              </Field>

              {/* Row: Rôle + Salaire/h */}
              <div
                className="invite-form-double"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
              >
                <Field label="Rôle" error={errors.role}>
                  <select
                    value={form.role}
                    onChange={(e) => set('role', e.target.value as EmployeeRole)}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: 8,
                      background: '#141A2B',
                      border: `1px solid ${errors.role ? 'rgba(239,68,68,.5)' : '#1B2236'}`,
                      color: ROLE_CONFIG[form.role].color,
                      fontSize: 13,
                      cursor: 'pointer',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                    aria-required="true"
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r} style={{ color: '#F4F6FB', background: '#141A2B' }}>
                        {ROLE_CONFIG[r].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Salaire/h ($)" error={errors.hourlyWage}>
                  <input
                    className="team-editable"
                    type="number"
                    step="0.25"
                    min="0"
                    max="200"
                    value={form.hourlyWage}
                    onChange={(e) => set('hourlyWage', parseFloat(e.target.value) || 0)}
                    placeholder="16.50"
                    style={{
                      border: `1px solid ${errors.hourlyWage ? 'rgba(239,68,68,.5)' : '#1B2236'}`,
                      borderRadius: 8,
                    }}
                    aria-required="true"
                  />
                </Field>
              </div>

              {/* Row: Multiplicateur FAIR + Date d'embauche */}
              <div
                className="invite-form-double"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
              >
                <Field label="Multiplicateur FAIR (×)" error={errors.coefficient}>
                  <input
                    className="team-editable"
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="10"
                    value={form.coefficient ?? 1}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      set('coefficient', Number.isFinite(v) ? v : 1);
                    }}
                    placeholder="1.00"
                    style={{
                      border: `1px solid ${errors.coefficient ? 'rgba(239,68,68,.5)' : '#1B2236'}`,
                      borderRadius: 8,
                    }}
                    aria-describedby="coeff-hint"
                  />
                </Field>
                <Field label="Date d'embauche" error={errors.hireDate}>
                  <input
                    className="team-editable"
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => set('hireDate', e.target.value)}
                    style={{
                      border: `1px solid ${errors.hireDate ? 'rgba(239,68,68,.5)' : '#1B2236'}`,
                      borderRadius: 8,
                      colorScheme: 'dark',
                    }}
                    aria-required="true"
                  />
                </Field>
              </div>

              {/* Coefficient hint */}
              <p
                id="coeff-hint"
                style={{ fontSize: 11, color: '#5A6485', margin: '-4px 0 0', lineHeight: 1.5 }}
              >
                Le multiplicateur ajuste la part de pourboires de cet employé.{' '}
                <span style={{ color: '#8892B0' }}>1.00 = part standard, 1.20 = +20 %.</span>
              </p>

              {/* Info banner */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(99,102,241,.08)',
                  border: '1px solid rgba(99,102,241,.18)',
                }}
              >
                <Sparkles size={14} style={{ color: '#818CF8', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#8892B0', margin: 0, lineHeight: 1.5 }}>
                  Un email d&apos;invitation sera envoyé pour activer le compte. L&apos;employé
                  pourra configurer son profil directement depuis le lien reçu.
                </p>
              </div>
            </div>
          ) : (
            /* QR mode — QUAL-M7: fonctionnalité à venir (not yet implemented) */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                padding: '40px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(99,102,241,.1)',
                  border: '1px solid rgba(99,102,241,.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={32} style={{ color: '#818CF8' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#F4F6FB', marginBottom: 8 }}>
                  Fonctionnalité à venir
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: '#5A6485',
                    margin: 0,
                    lineHeight: 1.6,
                    maxWidth: 300,
                  }}
                >
                  L&apos;invitation par QR Code sera disponible dans une prochaine mise à jour. En
                  attendant, utilisez l&apos;invitation par email.
                </p>
              </div>
              <button
                onClick={() => setMode('email')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'rgba(99,102,241,.12)',
                  border: '1px solid rgba(99,102,241,.25)',
                  color: '#818CF8',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Utiliser l&apos;email
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #1B2236',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            background: '#0A0E1A',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid #252D45',
              color: '#8892B0',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all .15s ease',
            }}
          >
            Annuler
          </button>
          {mode === 'email' && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                background: loading ? '#3730A3' : '#6366F1',
                border: '1px solid transparent',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background .15s ease',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Envoi…' : "Envoyer l'invitation"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Field wrapper ──────────────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          color: '#5A6485',
          marginBottom: 5,
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <span
          role="alert"
          style={{ fontSize: 10.5, color: '#EF4444', marginTop: 3, display: 'block' }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
