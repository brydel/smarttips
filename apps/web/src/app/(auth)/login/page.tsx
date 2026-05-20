'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Users, Sparkles } from 'lucide-react';
import { useAuth } from '../../../hooks/use-auth';
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

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type LoginForm = z.infer<typeof loginSchema>;

function getTimeChip() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = days[now.getDay()];
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${day} · ${h12}:${m} ${period}`;
}

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
        const decoded = decodeURIComponent(callbackUrl);
        if (decoded.startsWith('/') && !decoded.startsWith('//')) {
          targetUrl = decoded;
        }
      }

      router.push(targetUrl);
    } catch {
      setServerError('Email ou mot de passe incorrect. Veuillez réessayer.');
    }
  };

  const isExpired = searchParams.get('session') === 'expired';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '36px 56px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--st-d-0)',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <LogoMark />
          <div
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              fontSize: 13,
              color: 'var(--st-d-7)',
            }}
          >
            <a style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>Help</a>
            <a style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
              Contact sales
            </a>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="st-chip">
                <span
                  style={{
                    color: 'var(--st-emerald-glow)',
                    fontSize: 8,
                    lineHeight: 1,
                    marginRight: 4,
                  }}
                >
                  ●
                </span>
                {timeChip || 'Loading...'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--st-d-6)' }}>Service starts soon</span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--st-font-display)',
                fontSize: 44,
                color: 'var(--st-d-9)',
                margin: '0 0 10px',
                lineHeight: 1,
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              Welcome back.
              <br />
              <em
                style={{
                  fontFamily: 'var(--st-font-display)',
                  fontStyle: 'italic',
                  color: 'var(--st-d-7)',
                }}
              >
                The pool is waiting.
              </em>
            </h1>
            <p
              style={{ fontSize: 14, color: 'var(--st-d-7)', margin: '0 0 28px', lineHeight: 1.5 }}
            >
              Sign in to your SmartTips workspace.
            </p>

            {isExpired && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,.08)',
                  border: '1px solid rgba(239,68,68,.2)',
                  borderRadius: 'var(--st-r-md)',
                  fontSize: 12.5,
                  color: 'var(--st-danger)',
                }}
              >
                Votre session a expiré. Veuillez vous reconnecter.
              </div>
            )}
            {serverError && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,.08)',
                  border: '1px solid rgba(239,68,68,.2)',
                  borderRadius: 'var(--st-r-md)',
                  fontSize: 12.5,
                  color: 'var(--st-danger)',
                }}
              >
                {serverError}
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <Field
                label="Work email"
                type="email"
                placeholder="you@restaurant.com"
                autoFocus
                error={errors.email?.message}
                {...register('email')}
              />
              <Field
                label="Password"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                rightSlot={
                  <Link
                    href="/forgot-password"
                    style={{
                      color: 'var(--st-indigo-glow)',
                      fontWeight: 500,
                      fontSize: 11.5,
                      textDecoration: 'none',
                    }}
                  >
                    Forgot?
                  </Link>
                }
                {...register('password')}
              />

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: 'var(--st-d-7)',
                  cursor: 'pointer',
                  marginTop: 4,
                  userSelect: 'none',
                }}
              >
                <Checkbox checked={remember} onChange={(checked) => setRemember(checked)} />
                Keep me signed in on this device for 14 days
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="st-btn st-btn-primary"
                style={{
                  marginTop: 6,
                  justifyContent: 'center',
                  padding: '13px 18px',
                  width: '100%',
                }}
              >
                {isSubmitting ? (
                  'Connexion…'
                ) : (
                  <>
                    Sign in to dashboard <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <Divider>or continue with</Divider>

            <div style={{ display: 'flex', gap: 10 }}>
              <OAuthBtn type="button" label="Google" icon={<GoogleIcon />} />
              <OAuthBtn type="button" label="Microsoft" icon={<MicrosoftIcon />} />
              <OAuthBtn
                type="button"
                label="Magic link"
                icon={<Sparkles size={13} style={{ color: 'var(--st-gold)' }} />}
              />
            </div>

            <div
              style={{
                marginTop: 32,
                padding: 14,
                background: 'var(--st-d-1)',
                border: '1px solid var(--st-d-3)',
                borderRadius: 'var(--st-r-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <Users size={14} style={{ color: 'var(--st-d-7)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: 'var(--st-d-7)', lineHeight: 1.5 }}>
                Joining a team? Use the{' '}
                <a style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}>
                  invite link
                </a>{' '}
                from your manager — no signup needed.
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--st-d-7)', marginTop: 28 }}>
              New to SmartTips?{' '}
              <Link
                href="/signup"
                style={{ color: 'var(--st-indigo-glow)', fontWeight: 500, textDecoration: 'none' }}
              >
                Create an owner account →
              </Link>
            </p>
          </div>
        </div>

        <AuthFooter />
      </div>

      <AuthPhotoPane />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
