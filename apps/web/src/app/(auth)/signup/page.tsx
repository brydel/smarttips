'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../../../hooks/use-auth';
import { LogoMark, AuthPhotoPane, Field, Divider, Checkbox, AuthFooter } from '../_auth-components';

const LOCATION_OPTIONS = ['1', '2-5', '6-20', '20+'] as const;
type LocationRange = (typeof LOCATION_OPTIONS)[number];

const signupSchema = z.object({
  name: z.string().min(2, 'Veuillez entrer votre nom complet'),
  email: z.string().email('Adresse email invalide'),
  restaurantName: z.string().min(2, 'Veuillez entrer le nom de votre établissement'),
  password: z
    .string()
    .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
    .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
  accept: z.boolean().refine((v) => v, { message: 'Vous devez accepter les conditions' }),
});

type SignupForm = z.infer<typeof signupSchema>;

function getPasswordStrength(pwd: string): number {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

export default function SignupPage() {
  const { signup, isSubmitting } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<LocationRange>('2-5');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isValid },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { accept: true },
    mode: 'onChange',
  });

  const password = watch('password', '');
  const strength = getPasswordStrength(password);

  const onSubmit = async (data: SignupForm) => {
    setServerError(null);
    try {
      await signup({
        name: data.name,
        email: data.email,
        password: data.password,
        restaurantName: data.restaurantName,
      });
      router.push('/dashboard');
    } catch {
      setServerError("Une erreur est survenue lors de l'inscription. Veuillez réessayer.");
    }
  };

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
      <AuthPhotoPane />

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <span className="st-chip st-chip-gold">
                <Sparkles size={11} />
                14-day pilot · no card
              </span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--st-font-display)',
                fontSize: 40,
                color: 'var(--st-d-9)',
                margin: '0 0 10px',
                lineHeight: 1,
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              Start your workspace.
              <br />
              <em
                style={{
                  fontFamily: 'var(--st-font-display)',
                  fontStyle: 'italic',
                  color: 'var(--st-d-7)',
                }}
              >
                Train your model.
              </em>
            </h1>
            <p
              style={{ fontSize: 14, color: 'var(--st-d-7)', margin: '0 0 24px', lineHeight: 1.5 }}
            >
              From signup to first fair distribution:{' '}
              <strong style={{ color: 'var(--st-d-9)' }}>under 9 minutes</strong>.
            </p>

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
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <Field
                label="Your name"
                placeholder="First & last name"
                autoFocus
                error={errors.name?.message}
                {...register('name')}
              />
              <Field
                label="Work email"
                type="email"
                placeholder="you@restaurant.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
                <Field
                  label="Restaurant or franchise"
                  placeholder="e.g. Brasserie Nord"
                  error={errors.restaurantName?.message}
                  {...register('restaurantName')}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ fontSize: 12, color: 'var(--st-d-7)', fontWeight: 500 }}>
                    Locations
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      padding: 3,
                      background: 'var(--st-d-1)',
                      border: '1px solid var(--st-d-3)',
                      borderRadius: 'var(--st-r-md)',
                      height: 42,
                      alignItems: 'center',
                    }}
                  >
                    {LOCATION_OPTIONS.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setLocations(o)}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 'var(--st-r-sm)',
                          background: locations === o ? 'var(--st-d-3)' : 'transparent',
                          color: locations === o ? 'var(--st-d-9)' : 'var(--st-d-7)',
                          border: 0,
                          fontFamily: 'var(--st-font-ui)',
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all .12s',
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Field
                label="Password"
                type="password"
                placeholder="At least 10 characters"
                error={errors.password?.message}
                rightSlot={
                  <span
                    style={{
                      fontSize: 10.5,
                      color: 'var(--st-d-6)',
                      fontFamily: 'var(--st-font-mono)',
                    }}
                  >
                    {password.length}/10
                  </span>
                }
                {...register('password')}
              />

              <div style={{ display: 'flex', gap: 4, marginTop: -4 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background:
                        i < strength
                          ? password.length >= 10 && !errors.password
                            ? 'var(--st-emerald)'
                            : 'var(--st-gold)'
                          : 'var(--st-d-3)',
                      transition: 'background .2s',
                    }}
                  />
                ))}
              </div>

              <Controller
                control={control}
                name="accept"
                render={({ field: { value, onChange } }) => (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: 12,
                      color: 'var(--st-d-7)',
                      cursor: 'pointer',
                      marginTop: 6,
                      lineHeight: 1.5,
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ marginTop: 1 }}>
                      <Checkbox checked={value} onChange={onChange} />
                    </span>
                    <span>
                      I agree to the{' '}
                      <a style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}>
                        Terms
                      </a>{' '}
                      and acknowledge the{' '}
                      <a style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}>
                        Fair Distribution Policy
                      </a>
                      .
                    </span>
                  </label>
                )}
              />
              {errors.accept && (
                <span style={{ fontSize: 11.5, color: 'var(--st-danger)', marginTop: -4 }}>
                  {errors.accept.message}
                </span>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className="st-btn st-btn-primary"
                style={{
                  marginTop: 8,
                  justifyContent: 'center',
                  padding: '13px 18px',
                  width: '100%',
                }}
              >
                {isSubmitting ? (
                  'Création en cours…'
                ) : (
                  <>
                    Create workspace · start pilot <ArrowRight size={14} />
                  </>
                )}
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  color: 'var(--st-d-6)',
                  marginTop: 4,
                }}
              >
                <Shield size={11} style={{ color: 'var(--st-emerald)' }} />
                No credit card · cancel anytime · your data is yours
              </div>
            </form>

            <Divider>already with us</Divider>

            <p style={{ fontSize: 13, color: 'var(--st-d-7)', margin: 0, textAlign: 'center' }}>
              Have an account?{' '}
              <Link
                href="/login"
                style={{ color: 'var(--st-indigo-glow)', fontWeight: 500, textDecoration: 'none' }}
              >
                Sign in instead →
              </Link>
            </p>
          </div>
        </div>

        <AuthFooter />
      </div>
    </div>
  );
}
