'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Sparkles,
  QrCode,
  Mail,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AxiosError } from 'axios';
import { z } from 'zod';
import { EMPLOYEE_ROLES } from '../../../types/employee';
import { ROLE_CONFIG, ROLE_ORDER } from '../../../config/employee-roles';
import { useCreateEmployee } from '../../../hooks/use-employees';
import { useCreateInvitation } from '../../../hooks/use-invitations';
import type { EmployeeRole, CreateEmployeePayload } from '../../../types/employee';

// SEC-M2: délai minimum entre deux soumissions (anti double-clic)
const SUBMIT_COOLDOWN_MS = 2_000;

/** Extrait un message utilisateur depuis une erreur axios, avec gestion du 503 email. */
function extractInviteError(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    if (status === 503)
      return "Le service d'email est momentanément indisponible. Réessayez dans quelques instants.";
    if (status === 409) {
      const msg = err.response?.data?.message as string | undefined;
      if (typeof msg === 'string' && msg.includes('alreadyPending'))
        return 'Une invitation est déjà en attente pour cet employé.';
      if (typeof msg === 'string' && msg.includes('emailAlreadyUsed'))
        return 'Cet email est déjà utilisé dans votre restaurant.';
      if (typeof msg === 'string' && msg.includes('alreadyHasUser'))
        return 'Cet employé a déjà un compte actif.';
    }
    if (status === 404) return 'Employé introuvable.';
    if (status === 400) return 'Employé inactif ou non éligible.';
  }
  return "Impossible d'envoyer l'invitation. Réessayez.";
}

// ── Schéma de validation ──────────────────────────────────────────────────────
const inviteSchema = z.object({
  firstName: z.string().min(2, 'Min 2 caractères').max(100),
  lastName: z.string().min(2, 'Min 2 caractères').max(100),
  email: z.string().email('Email invalide').max(254),
  role: z.enum(EMPLOYEE_ROLES, { required_error: 'Rôle requis' }),
  hourlyWage: z.coerce.number({ invalid_type_error: 'Montant invalide' }).min(0).max(200),
  coefficient: z.coerce.number().min(0).max(10).optional(),
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis')
    .refine((d) => {
      const date = new Date(d + 'T12:00:00');
      return !isNaN(date.getTime()) && date <= new Date();
    }, "La date d'embauche ne peut pas être dans le futur"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Passer existingEmployee pour inviter un employé déjà créé (ex. depuis le drawer). */
export interface ExistingEmployeeForInvite {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

type ModalPhase =
  | { kind: 'form' }
  | { kind: 'submitting' }
  | {
      kind: 'success';
      email: string;
      inviteUrl: string;
      expiresAt: string;
      employeeCreated: boolean;
    }
  | { kind: 'partial-success'; employeeId: string; email: string; error: string }
  | { kind: 'error'; message: string };

export interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  /** Optionnel : pré-rempli si on invite un employé existant sans compte. */
  existingEmployee?: ExistingEmployeeForInvite | null;
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

// ── Composant principal ───────────────────────────────────────────────────────

export function InviteModal({ open, onClose, existingEmployee }: InviteModalProps) {
  const [mode, setMode] = useState<'email' | 'qr'>('email');
  const [form, setForm] = useState<InviteFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof InviteFormData, string>>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [phase, setPhase] = useState<ModalPhase>({ kind: 'form' });
  const [copied, setCopied] = useState(false);

  const lastSubmitRef = useRef<number>(0);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createEmployee = useCreateEmployee();
  const createInvitation = useCreateInvitation();

  const isExistingMode = !!existingEmployee;

  // Reset à l'ouverture / fermeture
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setMode('email');
      setPhase({ kind: 'form' });
      setCopied(false);
      setInviteEmail(existingEmployee?.email ?? '');
      setInviteEmailError('');
      focusTimerRef.current = setTimeout(() => firstInputRef.current?.focus(), 80);
    }
    return () => {
      if (focusTimerRef.current !== null) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [open, existingEmployee]);

  // Escape pour fermer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        if (phase.kind === 'form') onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, phase]);

  const set = useCallback(<K extends keyof InviteFormData>(k: K, v: InviteFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const next = { ...e };
      delete next[k];
      return next;
    });
  }, []);

  // ── Handler principal ─────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const now = Date.now();
    if (now - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) return;
    lastSubmitRef.current = now;

    // === Mode employé existant ===
    if (isExistingMode && existingEmployee) {
      const emailSchema = z.string().email('Email invalide').max(254);
      const emailResult = emailSchema.safeParse(inviteEmail.trim());
      if (!emailResult.success) {
        setInviteEmailError(emailResult.error.errors[0]?.message ?? 'Email invalide');
        return;
      }
      setInviteEmailError('');
      setPhase({ kind: 'submitting' });

      try {
        const invitation = await createInvitation.mutateAsync({
          employeeId: existingEmployee.id,
          email: emailResult.data,
        });
        setPhase({
          kind: 'success',
          email: invitation.email,
          inviteUrl: invitation.inviteUrl,
          expiresAt: invitation.expiresAt,
          employeeCreated: false,
        });
      } catch (err: unknown) {
        setPhase({ kind: 'error', message: extractInviteError(err) });
      }
      return;
    }

    // === Mode création nouvel employé ===
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

    setPhase({ kind: 'submitting' });

    const payload: CreateEmployeePayload = {
      firstName: result.data.firstName,
      lastName: result.data.lastName,
      email: result.data.email,
      role: result.data.role,
      hourlyWage: result.data.hourlyWage,
      hireDate: result.data.hireDate,
      coefficient: result.data.coefficient ?? 1,
    };

    let createdEmployeeId: string | null = null;

    try {
      // Étape 1 : créer l'employé
      const employee = await createEmployee.mutateAsync(payload);
      createdEmployeeId = employee.id;

      // Étape 2 : envoyer l'invitation
      const invitation = await createInvitation.mutateAsync({
        employeeId: employee.id,
        email: result.data.email,
      });

      setPhase({
        kind: 'success',
        email: invitation.email,
        inviteUrl: invitation.inviteUrl,
        expiresAt: invitation.expiresAt,
        employeeCreated: true,
      });
    } catch (err: unknown) {
      // Employé créé mais invitation échouée
      if (createdEmployeeId) {
        setPhase({
          kind: 'partial-success',
          employeeId: createdEmployeeId,
          email: result.data.email,
          error: extractInviteError(err),
        });
        return;
      }
      setPhase({ kind: 'error', message: extractInviteError(err) });
    }
  }, [form, isExistingMode, existingEmployee, inviteEmail, createEmployee, createInvitation]);

  // ── Retry invitation (partial success) ───────────────────────────────────

  const handleRetryInvitation = useCallback(
    async (employeeId: string, email: string) => {
      setPhase({ kind: 'submitting' });
      try {
        const invitation = await createInvitation.mutateAsync({ employeeId, email });
        setPhase({
          kind: 'success',
          email: invitation.email,
          inviteUrl: invitation.inviteUrl,
          expiresAt: invitation.expiresAt,
          employeeCreated: true,
        });
      } catch (err: unknown) {
        setPhase({ kind: 'partial-success', employeeId, email, error: extractInviteError(err) });
      }
    },
    [createInvitation],
  );

  // ── Copy link ─────────────────────────────────────────────────────────────

  const handleCopy = useCallback((url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  if (!open) return null;

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const title = isExistingMode
    ? `Inviter ${existingEmployee?.firstName} ${existingEmployee?.lastName}`
    : 'Inviter un employé';

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => phase.kind !== 'submitting' && onClose()}
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
          width: phase.kind === 'success' && mode === 'qr' ? 440 : 520,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)',
          background: '#0F1422',
          borderRadius: 16,
          border: '1px solid #1B2236',
          zIndex: 70,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width .2s ease',
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
              marginBottom: phase.kind === 'form' ? 16 : 0,
            }}
          >
            <h2
              id="invite-title"
              style={{ fontSize: 16, fontWeight: 700, color: '#F4F6FB', margin: 0 }}
            >
              {title}
            </h2>
            <button
              onClick={() => phase.kind !== 'submitting' && onClose()}
              aria-label="Fermer"
              disabled={phase.kind === 'submitting'}
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

          {/* Mode tabs — seulement sur le formulaire */}
          {phase.kind === 'form' && !isExistingMode && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setMode('email')}
                className={`team-tab${mode === 'email' ? ' active' : ''}`}
              >
                <Mail size={12} /> Email
              </button>
              <button
                onClick={() => setMode('qr')}
                className={`team-tab${mode === 'qr' ? ' active' : ''}`}
              >
                <QrCode size={12} /> QR Code
              </button>
            </div>
          )}

          {/* Mode tabs — sur l'écran de succès : vue email ou vue QR de l'invitation envoyée */}
          {phase.kind === 'success' && !isExistingMode && (
            <div style={{ marginTop: 12 }}>
              <p
                style={{
                  fontSize: 10,
                  color: '#5A6485',
                  margin: '0 0 6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Afficher l&apos;invitation
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setMode('email')}
                  className={`team-tab${mode === 'email' ? ' active' : ''}`}
                >
                  <Mail size={12} /> Confirmation email
                </button>
                <button
                  onClick={() => setMode('qr')}
                  className={`team-tab${mode === 'qr' ? ' active' : ''}`}
                >
                  <QrCode size={12} /> QR code sur place
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* ── PHASE : formulaire ── */}
          {phase.kind === 'form' && (
            <>
              {isExistingMode ? (
                <ExistingEmployeeForm
                  employee={existingEmployee!}
                  email={inviteEmail}
                  emailError={inviteEmailError}
                  onEmailChange={(v) => {
                    setInviteEmail(v);
                    setInviteEmailError('');
                  }}
                  firstInputRef={firstInputRef as React.RefObject<HTMLInputElement>}
                />
              ) : (
                <NewEmployeeForm
                  form={form}
                  errors={errors}
                  set={set}
                  firstInputRef={firstInputRef as React.RefObject<HTMLInputElement>}
                  mode={mode}
                />
              )}
            </>
          )}

          {/* ── PHASE : chargement ── */}
          {phase.kind === 'submitting' && (
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
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '3px solid #1B2236',
                  borderTopColor: '#6366F1',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p style={{ fontSize: 14, color: '#8892B0', margin: 0 }}>
                {isExistingMode ? "Envoi de l'invitation…" : 'Création et invitation en cours…'}
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── PHASE : succès (email mode) ── */}
          {phase.kind === 'success' && mode === 'email' && (
            <SuccessEmailView
              email={phase.email}
              inviteUrl={phase.inviteUrl}
              expiresAt={phase.expiresAt}
              employeeCreated={phase.employeeCreated}
              copied={copied}
              onCopy={handleCopy}
            />
          )}

          {/* ── PHASE : succès (QR mode) ── */}
          {phase.kind === 'success' && mode === 'qr' && (
            <SuccessQrView
              email={phase.email}
              inviteUrl={phase.inviteUrl}
              expiresAt={phase.expiresAt}
              copied={copied}
              onCopy={handleCopy}
            />
          )}

          {/* ── PHASE : succès partiel ── */}
          {phase.kind === 'partial-success' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(234,179,8,.06)',
                  border: '1px solid rgba(234,179,8,.18)',
                }}
              >
                <AlertTriangle
                  size={16}
                  style={{ color: '#EAB308', flexShrink: 0, marginTop: 1 }}
                />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#EAB308', margin: '0 0 4px' }}>
                    Employé créé, invitation en erreur
                  </p>
                  <p style={{ fontSize: 12, color: '#8892B0', margin: 0, lineHeight: 1.5 }}>
                    {phase.error}
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#5A6485', margin: 0 }}>
                L&apos;employ&eacute; a bien &eacute;t&eacute; cr&eacute;&eacute; dans votre
                &eacute;quipe. Vous pouvez r&eacute;essayer l&apos;envoi du lien d&apos;invitation.
              </p>
              <button
                onClick={() => handleRetryInvitation(phase.employeeId, phase.email)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
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
                <RefreshCw size={13} /> R&eacute;essayer l&apos;invitation
              </button>
            </div>
          )}

          {/* ── PHASE : erreur ── */}
          {phase.kind === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(239,68,68,.06)',
                  border: '1px solid rgba(239,68,68,.18)',
                }}
              >
                <AlertTriangle
                  size={16}
                  style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }}
                />
                <p style={{ fontSize: 13, color: '#EF4444', margin: 0, lineHeight: 1.5 }}>
                  {phase.message}
                </p>
              </div>
              <button
                onClick={() => setPhase({ kind: 'form' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
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
                <RefreshCw size={13} /> Réessayer
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
          {phase.kind === 'success' ||
          phase.kind === 'error' ||
          phase.kind === 'partial-success' ? (
            <button
              onClick={onClose}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid #252D45',
                color: '#8892B0',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Fermer
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={phase.kind === 'submitting'}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid #252D45',
                  color: '#8892B0',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={phase.kind === 'submitting'}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  background: phase.kind === 'submitting' ? '#3730A3' : '#6366F1',
                  border: '1px solid transparent',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: phase.kind === 'submitting' ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: phase.kind === 'submitting' ? 0.7 : 1,
                }}
              >
                {phase.kind === 'submitting'
                  ? 'Envoi…'
                  : mode === 'qr'
                    ? 'Générer le QR'
                    : "Envoyer l'invitation"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function ExistingEmployeeForm({
  employee,
  email,
  emailError,
  onEmailChange,
  firstInputRef,
}: {
  employee: ExistingEmployeeForInvite;
  email: string;
  emailError: string;
  onEmailChange: (v: string) => void;
  firstInputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: '#141A2B',
          border: '1px solid #1B2236',
        }}
      >
        <p style={{ fontSize: 12, color: '#5A6485', margin: '0 0 2px' }}>Employé sélectionné</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#F4F6FB', margin: 0 }}>
          {employee.firstName} {employee.lastName}
        </p>
      </div>
      <Field label="Email d'invitation" error={emailError}>
        <input
          ref={firstInputRef}
          className="team-editable"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="employe@restaurant.com"
          maxLength={254}
          style={{
            border: `1px solid ${emailError ? 'rgba(239,68,68,.5)' : '#1B2236'}`,
            borderRadius: 8,
          }}
          aria-required="true"
        />
      </Field>
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
          Un magic link valable 7 jours sera envoyé à cet email pour créer le compte.
        </p>
      </div>
    </div>
  );
}

function NewEmployeeForm({
  form,
  errors,
  set,
  firstInputRef,
  mode,
}: {
  form: InviteFormData;
  errors: Partial<Record<keyof InviteFormData, string>>;
  set: <K extends keyof InviteFormData>(k: K, v: InviteFormData[K]) => void;
  firstInputRef: React.RefObject<HTMLInputElement>;
  mode: 'email' | 'qr';
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Nom row — className contrôle la grille, pas le style inline (RESP-C1) */}
      <div className="invite-form-double">
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

      {/* Rôle + Salaire */}
      <div className="invite-form-double">
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

      {/* Coeff + Date */}
      <div className="invite-form-double">
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

      <p
        id="coeff-hint"
        style={{ fontSize: 11, color: '#5A6485', margin: '-4px 0 0', lineHeight: 1.5 }}
      >
        Le multiplicateur ajuste la part de pourboires.{' '}
        <span style={{ color: '#8892B0' }}>1.00 = standard, 1.20 = +20 %.</span>
      </p>

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
          {mode === 'qr'
            ? "L'employé sera créé, un email d'invitation sera envoyé et un QR code vous sera affiché pour un accès immédiat sur place."
            : "Un email d'invitation sera envoyé pour activer le compte. L'employé pourra configurer son profil depuis le lien reçu."}
        </p>
      </div>
    </div>
  );
}

function SuccessEmailView({
  email,
  inviteUrl,
  expiresAt,
  employeeCreated,
  copied,
  onCopy,
}: {
  email: string;
  inviteUrl: string;
  expiresAt: string;
  employeeCreated: boolean;
  copied: boolean;
  onCopy: (url: string) => void;
}) {
  const expireDate = new Date(expiresAt).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const [showQr, setShowQr] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(52,211,153,.06)',
          border: '1px solid rgba(52,211,153,.18)',
        }}
      >
        <CheckCircle2 size={16} style={{ color: '#34D399', flexShrink: 0, marginTop: 1 }} />
        <div>
          {employeeCreated && (
            <p style={{ fontSize: 12, color: '#34D399', margin: '0 0 2px', fontWeight: 600 }}>
              Employé créé ✓
            </p>
          )}
          <p style={{ fontSize: 12, color: '#34D399', margin: 0, fontWeight: 600 }}>
            Invitation envoyée à {email} ✓
          </p>
          <p style={{ fontSize: 11, color: '#5A6485', margin: '4px 0 0' }}>
            Lien valide jusqu&apos;au {expireDate}
          </p>
        </div>
      </div>

      {/* Copy link */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
            padding: '7px 10px',
            borderRadius: 8,
            background: '#141A2B',
            border: '1px solid #1B2236',
            fontSize: 11,
            color: '#5A6485',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}
        >
          {inviteUrl}
        </div>
        <button
          onClick={() => onCopy(inviteUrl)}
          aria-label={copied ? 'Lien copié' : 'Copier le lien'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 12px',
            borderRadius: 8,
            background: copied ? 'rgba(52,211,153,.12)' : 'rgba(99,102,241,.12)',
            border: `1px solid ${copied ? 'rgba(52,211,153,.25)' : 'rgba(99,102,241,.25)'}`,
            color: copied ? '#34D399' : '#818CF8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
            transition: 'all .15s ease',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>

      {/* QR accordéon */}
      <button
        onClick={() => setShowQr((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 12px',
          borderRadius: 8,
          background: 'transparent',
          border: '1px solid #252D45',
          color: '#8892B0',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          width: 'fit-content',
        }}
      >
        <QrCode size={13} />
        {showQr ? 'Masquer le QR code' : 'Afficher le QR code'}
      </button>

      {showQr && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '16px',
            borderRadius: 12,
            background: '#fff',
          }}
        >
          <QRCodeSVG value={inviteUrl} size={180} />
        </div>
      )}
    </div>
  );
}

function SuccessQrView({
  email,
  inviteUrl,
  expiresAt,
  copied,
  onCopy,
}: {
  email: string;
  inviteUrl: string;
  expiresAt: string;
  copied: boolean;
  onCopy: (url: string) => void;
}) {
  const expireDate = new Date(expiresAt).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <CheckCircle2 size={14} style={{ color: '#34D399' }} />
        <p style={{ fontSize: 13, color: '#34D399', margin: 0 }}>Email envoyé à {email}</p>
      </div>

      <p style={{ fontSize: 12, color: '#8892B0', margin: 0, textAlign: 'center' }}>
        Faites scanner ce QR code par l&apos;employ&eacute; sur place
      </p>

      {/* QR code centré */}
      <div
        style={{
          padding: '20px',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,.3)',
        }}
      >
        <QRCodeSVG value={inviteUrl} size={200} />
      </div>

      <p style={{ fontSize: 11, color: '#5A6485', margin: 0 }}>
        Valide jusqu&apos;au {expireDate} &middot; usage unique
      </p>

      {/* Copy link */}
      <button
        onClick={() => onCopy(inviteUrl)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          borderRadius: 8,
          background: copied ? 'rgba(52,211,153,.12)' : 'rgba(99,102,241,.12)',
          border: `1px solid ${copied ? 'rgba(52,211,153,.25)' : 'rgba(99,102,241,.25)'}`,
          color: copied ? '#34D399' : '#818CF8',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all .15s ease',
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Lien copié' : 'Copier le lien'}
      </button>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
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
