'use client';

/**
 * Page publique d'acceptation d'invitation BIS-43.
 * Route: /invite?token=RAW_TOKEN
 *
 * Sécurité :
 * - Token lu uniquement depuis le query param, jamais depuis le body
 * - Jamais de tokenHash exposé en UI
 * - Jamais de tenantId/employeeId/role envoyés par le client
 * - Pas de connexion auto avant acceptation réussie
 */

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { z } from 'zod';
import { validateInvitation, acceptInvitation } from '../../services/invitations.service';
import { useAuth } from '../../hooks/use-auth';
import type { InvitationValidationResponse } from '../../services/invitations.service';
import type { AuthUser } from '../../contexts/auth.context';

// ── Schéma de validation du formulaire d'acceptation ─────────────────────────
const acceptSchema = z
  .object({
    firstName: z.string().min(1, 'Prénom requis').max(100, 'Prénom trop long'),
    lastName: z.string().min(1, 'Nom requis').max(100, 'Nom trop long'),
    password: z
      .string()
      .min(8, 'Minimum 8 caractères')
      .max(72, 'Maximum 72 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
        'Doit contenir une majuscule, une minuscule et un chiffre',
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type AcceptForm = z.infer<typeof acceptSchema>;

type PagePhase =
  | { kind: 'loading' }
  | { kind: 'valid'; data: InvitationValidationResponse }
  | {
      kind: 'invalid';
      reason: 'expired' | 'revoked' | 'accepted' | 'not_found' | 'generic';
      message: string;
    }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'submit_error'; message: string };

// ── Page wrapper avec Suspense pour useSearchParams ───────────────────────────

export default function InvitePage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <InvitePageInner />
    </Suspense>
  );
}

function InvitePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginWithSession } = useAuth();

  const token = searchParams.get('token');

  const [phase, setPhase] = useState<PagePhase>({ kind: 'loading' });
  const [form, setForm] = useState<AcceptForm>({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AcceptForm, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const didValidate = useRef(false);

  // ── Validation du token ────────────────────────────────────────────────────

  useEffect(() => {
    if (didValidate.current) return;
    didValidate.current = true;

    if (!token) {
      setPhase({
        kind: 'invalid',
        reason: 'not_found',
        message: "Aucun token d'invitation trouvé dans ce lien.",
      });
      return;
    }

    async function validate() {
      try {
        const data = await validateInvitation(token!);
        setPhase({ kind: 'valid', data });
        // Pré-remplir le prénom/nom depuis la DB
        setForm((f) => ({
          ...f,
          firstName: data.employee.firstName,
          lastName: data.employee.lastName,
        }));
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number; data?: { message?: string } } })
          ?.response?.status;
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';

        if (status === 404) {
          setPhase({
            kind: 'invalid',
            reason: 'not_found',
            message: "Cette invitation est invalide ou n'existe pas.",
          });
        } else if (status === 422) {
          const isExpired = typeof msg === 'string' && msg.includes('expired');
          setPhase({
            kind: 'invalid',
            reason: isExpired ? 'expired' : 'accepted',
            message: isExpired
              ? 'Cette invitation a expiré. Contactez votre gestionnaire pour en obtenir une nouvelle.'
              : "Cette invitation n'est plus disponible (déjà utilisée ou révoquée).",
          });
        } else {
          setPhase({
            kind: 'invalid',
            reason: 'generic',
            message: 'Une erreur est survenue. Réessayez plus tard.',
          });
        }
      }
    }

    void validate();
  }, [token]);

  // ── Soumission du formulaire ───────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token) return;

      const result = acceptSchema.safeParse(form);
      if (!result.success) {
        const errs: Partial<Record<keyof AcceptForm, string>> = {};
        result.error.errors.forEach((err) => {
          const key = err.path[0] as keyof AcceptForm;
          if (!errs[key]) errs[key] = err.message;
        });
        setFieldErrors(errs);
        return;
      }

      setFieldErrors({});
      setPhase({ kind: 'submitting' });

      try {
        // SEC: seuls firstName/lastName/password envoyés — jamais tenantId/employeeId/role
        const response = await acceptInvitation(token, {
          firstName: result.data.firstName,
          lastName: result.data.lastName,
          password: result.data.password,
        });

        // Hydrate l'auth context avec l'accessToken retourné
        const sessionUser: AuthUser = {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          role: response.user.role,
          tenantId: response.user.tenantId,
          tenantName: '', // sera rechargé via /auth/me si nécessaire
        };
        loginWithSession(response.accessToken, sessionUser);

        setPhase({ kind: 'success' });

        // Redirection vers l'espace employé après 1.5s
        setTimeout(() => {
          router.replace('/employee/dashboard');
        }, 1500);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number; data?: { message?: string } } })
          ?.response?.status;
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;

        let errorMessage = 'Une erreur est survenue. Réessayez.';
        if (status === 409) {
          errorMessage = 'Cette adresse email est déjà associée à un compte.';
        } else if (status === 404 || status === 422) {
          errorMessage = "Ce lien d'invitation n'est plus valide.";
        } else if (typeof msg === 'string' && msg.length < 200) {
          errorMessage = msg;
        }

        setPhase({ kind: 'submit_error', message: errorMessage });
      }
    },
    [token, form, loginWithSession, router],
  );

  const set = useCallback(<K extends keyof AcceptForm>(k: K, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0A0E1A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo / titre */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: '#F4F6FB',
              letterSpacing: '-0.02em',
              marginBottom: 4,
            }}
          >
            Smart<span style={{ color: '#6366F1' }}>Tips</span>
          </div>
          <p style={{ fontSize: 13, color: '#5A6485', margin: 0 }}>
            Portail d&apos;activation de compte employ&eacute;
          </p>
        </div>

        {/* Card principale */}
        <div
          style={{
            background: '#0F1422',
            borderRadius: 16,
            border: '1px solid #1B2236',
            overflow: 'hidden',
          }}
        >
          {/* ── Loading ── */}
          {phase.kind === 'loading' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '48px 24px',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '3px solid #1B2236',
                  borderTopColor: '#6366F1',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p style={{ fontSize: 14, color: '#8892B0', margin: 0 }}>
                V&eacute;rification de l&apos;invitation&hellip;
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── Invalid ── */}
          {phase.kind === 'invalid' && (
            <div style={{ padding: '36px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>
                {phase.reason === 'expired' ? '⏰' : phase.reason === 'accepted' ? '✅' : '🚫'}
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#F4F6FB', margin: '0 0 12px' }}>
                {phase.reason === 'expired'
                  ? 'Invitation expirée'
                  : phase.reason === 'accepted'
                    ? 'Invitation déjà utilisée'
                    : 'Invitation invalide'}
              </h1>
              <p style={{ fontSize: 14, color: '#8892B0', margin: '0 0 24px', lineHeight: 1.6 }}>
                {phase.message}
              </p>
              <a
                href="mailto:support@smarttips.app"
                style={{ fontSize: 13, color: '#818CF8', textDecoration: 'none' }}
              >
                Contacter le support →
              </a>
            </div>
          )}

          {/* ── Formulaire d'acceptation ── */}
          {(phase.kind === 'valid' || phase.kind === 'submit_error') && (
            <div style={{ padding: '28px 24px' }}>
              {/* Info restaurant */}
              {phase.kind === 'valid' && (
                <div
                  style={{
                    marginBottom: 24,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: '#141A2B',
                    border: '1px solid #1B2236',
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: '#5A6485',
                      margin: '0 0 2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 600,
                    }}
                  >
                    Invitation de
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#F4F6FB', margin: '0 0 4px' }}>
                    {phase.data.tenant.name}
                  </p>
                  <p style={{ fontSize: 12, color: '#8892B0', margin: 0 }}>
                    Compte : <span style={{ color: '#C5CCE0' }}>{phase.data.email}</span>
                  </p>
                </div>
              )}

              {/* Erreur submit */}
              {phase.kind === 'submit_error' && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(239,68,68,.06)',
                    border: '1px solid rgba(239,68,68,.18)',
                  }}
                >
                  <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{phase.message}</p>
                </div>
              )}

              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F4F6FB', margin: '0 0 20px' }}>
                Créer votre compte
              </h2>

              <form
                onSubmit={(e) => void handleSubmit(e)}
                noValidate
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                {/* Prénom + Nom */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormField label="Prénom" error={fieldErrors.firstName} required>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => set('firstName', e.target.value)}
                      maxLength={100}
                      autoComplete="given-name"
                      style={inputStyle(!!fieldErrors.firstName)}
                      aria-required="true"
                    />
                  </FormField>
                  <FormField label="Nom" error={fieldErrors.lastName} required>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => set('lastName', e.target.value)}
                      maxLength={100}
                      autoComplete="family-name"
                      style={inputStyle(!!fieldErrors.lastName)}
                      aria-required="true"
                    />
                  </FormField>
                </div>

                {/* Mot de passe */}
                <FormField
                  label="Mot de passe"
                  error={fieldErrors.password}
                  required
                  hint="Min. 8 caractères, une majuscule, une minuscule, un chiffre"
                >
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      maxLength={72}
                      autoComplete="new-password"
                      style={{ ...inputStyle(!!fieldErrors.password), paddingRight: 40 }}
                      aria-required="true"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                      }
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#5A6485',
                        fontSize: 11,
                        fontFamily: 'inherit',
                      }}
                    >
                      {showPassword ? 'Masquer' : 'Afficher'}
                    </button>
                  </div>
                </FormField>

                {/* Confirmation */}
                <FormField
                  label="Confirmer le mot de passe"
                  error={fieldErrors.confirmPassword}
                  required
                >
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                    maxLength={72}
                    autoComplete="new-password"
                    style={inputStyle(!!fieldErrors.confirmPassword)}
                    aria-required="true"
                  />
                </FormField>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    background: '#6366F1',
                    border: 'none',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginTop: 4,
                    transition: 'background .15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#4F46E5';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#6366F1';
                  }}
                >
                  Créer mon compte
                </button>
              </form>
            </div>
          )}

          {/* ── Chargement submit ── */}
          {phase.kind === 'submitting' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '48px 24px',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '3px solid #1B2236',
                  borderTopColor: '#6366F1',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p style={{ fontSize: 14, color: '#8892B0', margin: 0 }}>Création de votre compte…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── Succès ── */}
          {phase.kind === 'success' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(52,211,153,.12)',
                  border: '1px solid rgba(52,211,153,.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                ✓
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F4F6FB', margin: '0 0 8px' }}>
                  Compte créé avec succès !
                </h2>
                <p style={{ fontSize: 14, color: '#8892B0', margin: 0 }}>
                  Redirection vers votre espace employé…
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#3A4366', marginTop: 24 }}>
          SmartTips · Pourboires équitables pour tous
        </p>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FullPageSpinner() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0A0E1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid #1B2236',
          borderTopColor: '#6366F1',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function FormField({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          color: '#8892B0',
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: '#EF4444', marginLeft: 2 }}>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p style={{ fontSize: 11, color: '#5A6485', margin: '4px 0 0', lineHeight: 1.4 }}>{hint}</p>
      )}
      {error && (
        <p role="alert" style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    // padding-y à 12px → hauteur ~44px (WCAG 2.5.5 touch target minimum)
    padding: '12px 12px',
    borderRadius: 8,
    background: '#141A2B',
    border: `1px solid ${hasError ? 'rgba(239,68,68,.5)' : '#252D45'}`,
    color: '#F4F6FB',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color .15s ease',
  };
}
