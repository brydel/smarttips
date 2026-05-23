'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Shield, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useAuth } from '../../../hooks/use-auth';
import { extractErrorMessage } from '../../../lib/errors';
import { LogoMark, AuthPhotoPane, Field, Divider, Checkbox, AuthFooter } from '../_auth-components';

// ── Constants ─────────────────────────────────────────────────────────────────
const LOCATION_OPTIONS = ['1', '2-5', '6-20', '20+'] as const;
type LocationRange = (typeof LOCATION_OPTIONS)[number];

// ── Schema ────────────────────────────────────────────────────────────────────
const signupSchema = z.object({
  name: z.string().min(2, 'Veuillez entrer votre nom complet'),
  email: z.string().email('Adresse e-mail invalide'),
  restaurantName: z.string().min(2, 'Veuillez entrer le nom de votre établissement'),
  password: z
    .string()
    .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
    .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
  accept: z.boolean().refine((v) => v, { message: 'Vous devez accepter les conditions' }),
});

type SignupForm = z.infer<typeof signupSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPasswordStrength(pwd: string): number {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

// ── Page ──────────────────────────────────────────────────────────────────────
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
    } catch (err) {
      setServerError(
        extractErrorMessage(
          err,
          "Une erreur est survenue lors de l'inscription. Veuillez réessayer.",
        ),
      );
    }
  };

  return (
    <div className="grid md:grid-cols-2 w-full min-h-screen overflow-hidden">
      {/* ── Photo pane ────────────────────────────────────────────────────── */}
      <AuthPhotoPane />

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
            {/* Chip */}
            <div className="flex items-center gap-[6px] mb-[14px]">
              <span className="st-chip st-chip-gold">
                <Sparkles size={11} />
                14 jours d&apos;essai · sans carte
              </span>
            </div>

            {/* Headline */}
            <h1 className="st-display text-[36px] md:text-[40px] text-st-hi mb-[10px] leading-none">
              Créez votre espace.
              <br />
              <em className="text-st-sec">Entraînez votre modèle.</em>
            </h1>
            <p className="text-[14px] text-st-sec mb-6 leading-[1.5]">
              De l&apos;inscription à la première distribution équitable :{' '}
              <strong className="text-st-hi">moins de 9 minutes</strong>.
            </p>

            {/* Server error */}
            {serverError && (
              <div className="mb-4 px-[14px] py-[10px] bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.2)] rounded-md text-[12.5px] text-st-danger">
                {serverError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
              <Field
                label="Votre nom"
                placeholder="Prénom et nom"
                autoFocus
                error={errors.name?.message}
                {...register('name')}
              />
              <Field
                label="Adresse e-mail"
                type="email"
                placeholder="vous@restaurant.com"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />

              {/* Restaurant + Locations row */}
              <div className="grid grid-cols-[1.4fr_1fr] gap-[10px]">
                <Field
                  label="Restaurant ou franchise"
                  placeholder="ex. Brasserie Nord"
                  error={errors.restaurantName?.message}
                  {...register('restaurantName')}
                />

                <div className="flex flex-col gap-[7px]">
                  <span className="text-xs font-medium text-st-sec">Établissements</span>
                  <div className="flex gap-1 p-[3px] bg-st-card border border-st-border rounded-md h-[42px] items-center">
                    {LOCATION_OPTIONS.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setLocations(o)}
                        className={cn(
                          'flex-1 py-[7px] rounded-sm text-[11.5px] font-medium font-sans transition-all cursor-pointer border-0',
                          locations === o
                            ? 'bg-st-border text-st-hi'
                            : 'bg-transparent text-st-sec hover:text-st-pri',
                        )}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Password */}
              <Field
                label="Mot de passe"
                type="password"
                placeholder="Au moins 10 caractères"
                autoComplete="new-password"
                error={errors.password?.message}
                rightSlot={
                  <span className="text-[10.5px] text-st-dim font-mono">{password.length}/10</span>
                }
                {...register('password')}
              />

              {/* Strength bar */}
              <div className="flex gap-1 -mt-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="flex-1 h-[3px] rounded-[2px] transition-colors"
                    style={{
                      background:
                        i < strength
                          ? password.length >= 10 && !errors.password
                            ? 'var(--st-emerald)'
                            : 'var(--st-gold)'
                          : 'var(--st-d-3)',
                    }}
                  />
                ))}
              </div>

              {/* Terms checkbox */}
              <Controller
                control={control}
                name="accept"
                render={({ field: { value, onChange } }) => (
                  <label className="flex items-start gap-2 text-[12px] text-st-sec cursor-pointer mt-[6px] leading-[1.5] select-none">
                    <span className="mt-[1px]">
                      <Checkbox checked={value} onChange={onChange} />
                    </span>
                    <span>
                      J&apos;accepte les{' '}
                      <a className="text-st-indigo-glow no-underline cursor-pointer hover:opacity-80">
                        Conditions d&apos;utilisation
                      </a>{' '}
                      et la{' '}
                      <a className="text-st-indigo-glow no-underline cursor-pointer hover:opacity-80">
                        Politique de distribution équitable
                      </a>
                      .
                    </span>
                  </label>
                )}
              />
              {errors.accept && (
                <span className="text-[11.5px] text-st-danger -mt-1">{errors.accept.message}</span>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className="st-btn st-btn-primary mt-2 justify-center w-full py-[13px]"
              >
                {isSubmitting ? (
                  'Création en cours…'
                ) : (
                  <>
                    Créer mon espace · démarrer le pilote <ArrowRight size={14} />
                  </>
                )}
              </button>

              {/* Trust line */}
              <div className="flex items-center justify-center gap-[6px] text-[11.5px] text-st-dim mt-1">
                <Shield size={11} className="text-st-emerald" />
                Sans carte bancaire · résiliez à tout moment · vos données vous appartiennent
              </div>
            </form>

            <Divider>déjà avec nous</Divider>

            <p className="text-[13px] text-st-sec text-center">
              Vous avez déjà un compte ?{' '}
              <Link
                href="/login"
                className="text-st-indigo-glow font-medium no-underline hover:opacity-80"
              >
                Se connecter →
              </Link>
            </p>
          </div>
        </div>

        <AuthFooter />
      </div>
    </div>
  );
}
