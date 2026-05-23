'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Users, Sparkles } from 'lucide-react';
import { useAuth } from '../../../hooks/use-auth';
import { extractErrorMessage } from '../../../lib/errors';
import {
  LogoMark,
  AuthPhotoPane,
  Field,
  Divider,
  OAuthBtn,
  Checkbox,
  AuthFooter,
  GoogleIcon,
  MicrosoftIcon,
} from '../_auth-components';

// ── Schema ────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type LoginForm = z.infer<typeof loginSchema>;

// ── Time chip helper ──────────────────────────────────────────────────────────
function getTimeChip(): string {
  const now = new Date();
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const day = days[now.getDay()] ?? '';
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${day} · ${h}h${m}`;
}

// ── Login Form ────────────────────────────────────────────────────────────────
function LoginForm() {
  const { login, isSubmitting } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [remember, setRemember] = useState(true);
  const [timeChip, setTimeChip] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    setTimeChip(getTimeChip());
  }, []);

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      await login({ email: data.email, password: data.password });

      const callbackUrl = searchParams.get('callbackUrl');
      let targetUrl = '/dashboard';

      if (callbackUrl) {
        try {
          const decoded = decodeURIComponent(callbackUrl);
          // Validate same-origin: reject protocol-relative or external URLs
          const resolved = new URL(decoded, window.location.origin);
          if (resolved.origin === window.location.origin) {
            targetUrl = decoded;
          }
        } catch {
          // malformed URL — fall back to /dashboard
        }
      }

      router.push(targetUrl);
    } catch (err) {
      setServerError(
        extractErrorMessage(err, 'Email ou mot de passe incorrect. Veuillez réessayer.'),
      );
    }
  };

  const isExpired = searchParams.get('session') === 'expired';
  const isAccessDenied = searchParams.get('reason') === 'access_denied';

  return (
    <div className="grid md:grid-cols-2 w-full min-h-screen overflow-hidden">
      {/* ── Form pane ─────────────────────────────────────────────────────── */}
      <div className="px-9 py-9 md:px-14 flex flex-col bg-st-bg overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <LogoMark />
          <div className="flex gap-[14px] items-center text-[13px] text-st-sec">
            <a className="cursor-pointer hover:text-st-pri transition-colors">Aide</a>
            <a className="cursor-pointer hover:text-st-pri transition-colors">Contact</a>
          </div>
        </div>

        {/* Form content */}
        <div className="flex-1 flex items-center py-10 md:py-0">
          <div className="w-full max-w-[420px]">
            {/* Status chip */}
            <div className="flex items-center gap-2 mb-[14px]">
              <span className="st-chip">
                <span className="text-st-emerald-glow text-[8px] leading-none">●</span>
                {timeChip || 'Services opérationnels'}
              </span>
              <span className="text-[11.5px] text-st-dim">Le service commence bientôt</span>
            </div>

            {/* Headline */}
            <h1 className="st-display text-[40px] md:text-[44px] text-st-hi mb-[10px] leading-none">
              Bon retour.
              <br />
              <em className="text-st-sec">Le pool vous attend.</em>
            </h1>
            <p className="text-[14px] text-st-sec mb-7 leading-[1.5]">
              Accédez à votre espace SmartTips.
            </p>

            {/* Alerts */}
            {isExpired && (
              <div className="mb-4 px-[14px] py-[10px] bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.2)] rounded-md text-[12.5px] text-st-danger">
                Votre session a expiré. Veuillez vous reconnecter.
              </div>
            )}
            {isAccessDenied && (
              <div className="mb-4 px-[14px] py-[10px] bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.2)] rounded-md text-[12.5px] text-st-danger">
                Accès refusé. Seuls les gérants et propriétaires peuvent accéder au tableau de bord.
              </div>
            )}
            {serverError && (
              <div className="mb-4 px-[14px] py-[10px] bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.2)] rounded-md text-[12.5px] text-st-danger">
                {serverError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[14px]">
              <Field
                label="Adresse e-mail"
                type="email"
                placeholder="vous@restaurant.com"
                autoComplete="email"
                autoFocus
                error={errors.email?.message}
                {...register('email')}
              />
              <Field
                label="Mot de passe"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.password?.message}
                rightSlot={
                  <Link
                    href="/forgot-password"
                    className="text-st-indigo-glow font-medium text-[11.5px] no-underline hover:opacity-80 transition-opacity"
                  >
                    Oublié ?
                  </Link>
                }
                {...register('password')}
              />

              <label className="flex items-center gap-2 text-[12.5px] text-st-sec cursor-pointer mt-1 select-none">
                <Checkbox checked={remember} onChange={setRemember} />
                Rester connecté pendant 14 jours
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="st-btn st-btn-primary mt-[6px] justify-center w-full py-[13px]"
              >
                {isSubmitting ? (
                  'Connexion…'
                ) : (
                  <>
                    Accéder au tableau de bord <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <Divider>ou continuer avec</Divider>

            <div className="flex gap-[10px]">
              <OAuthBtn type="button" label="Google" icon={<GoogleIcon />} />
              <OAuthBtn type="button" label="Microsoft" icon={<MicrosoftIcon />} />
              <OAuthBtn
                type="button"
                label="Lien magique"
                icon={<Sparkles size={13} className="text-st-gold" />}
              />
            </div>

            {/* Invite card */}
            <div className="mt-8 p-[14px] bg-st-card border border-st-border rounded-md flex items-start gap-[10px]">
              <Users size={14} className="text-st-sec shrink-0 mt-[2px]" />
              <div className="text-[12px] text-st-sec leading-[1.5]">
                Vous rejoignez une équipe ? Utilisez le{' '}
                <a className="text-st-indigo-glow no-underline cursor-pointer hover:opacity-80">
                  lien d&apos;invitation
                </a>{' '}
                de votre responsable — aucune inscription nécessaire.
              </div>
            </div>

            <p className="text-[12.5px] text-st-sec mt-7">
              Nouveau sur SmartTips ?{' '}
              <Link
                href="/signup"
                className="text-st-indigo-glow font-medium no-underline hover:opacity-80"
              >
                Créer un compte →
              </Link>
            </p>
          </div>
        </div>

        <AuthFooter />
      </div>

      {/* ── Photo pane ────────────────────────────────────────────────────── */}
      <AuthPhotoPane />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function LoginFallback() {
  return (
    <div className="min-h-screen bg-st-bg flex items-center justify-center">
      <svg
        className="animate-spin text-st-indigo"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
