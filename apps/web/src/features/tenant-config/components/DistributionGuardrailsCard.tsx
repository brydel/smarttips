'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type {
  DistributionConfig,
  DistributionValidationErrors,
  ConfigNumericKey,
} from '../types/tenant-config.types';

interface GuardrailsCardProps {
  config: DistributionConfig;
  original: DistributionConfig;
  onChange: (key: ConfigNumericKey, value: number) => void;
  readOnly: boolean;
  errors: DistributionValidationErrors;
}

// ── Reusable numeric field with unit ──────────────────────────────────────

interface NumericFieldProps {
  label: string;
  hint: string;
  value: number;
  original: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  barColor: string;
  barMax: number;
  readOnly: boolean;
  error?: string;
  onChange: (v: number) => void;
  children?: React.ReactNode; // extra content below bar (warnings, examples)
}

function NumericField({
  label,
  hint,
  value,
  original,
  min,
  max,
  step,
  prefix,
  suffix,
  barColor,
  barMax,
  readOnly,
  error,
  onChange,
  children,
}: NumericFieldProps) {
  const [local, setLocal] = useState(String(value));
  const isDirty = Math.abs(value - original) > 0.0001;

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  const commit = useCallback(() => {
    const n = parseFloat(local);
    if (isNaN(n)) {
      setLocal(String(value));
      return;
    }
    onChange(Math.max(min, Math.min(max, n)));
  }, [local, value, min, max, onChange]);

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[13px] text-st-hi font-medium">{label}</label>
        {isDirty && !readOnly && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill bg-st-emerald/10 border border-st-emerald/30 text-st-emerald-glow text-[10.5px] font-mono">
            ● modifié
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-st-sec leading-[1.55] mb-3">{hint}</p>

      {/* Input + bar row */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Number input with unit */}
        <div
          className={cn(
            'inline-flex items-center gap-1 rounded-sm border px-2.5 py-2 min-w-[110px]',
            'transition-colors duration-150',
            readOnly ? 'opacity-60 bg-st-raised border-st-border' : 'bg-st-raised border-st-border',
            !readOnly &&
              'hover:border-st-muted focus-within:border-st-indigo focus-within:ring-1 focus-within:ring-st-indigo/20',
            error && 'border-st-danger',
          )}
        >
          {prefix && <span className="font-mono text-st-sec text-[13px]">{prefix}</span>}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            disabled={readOnly}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="bg-transparent border-0 outline-none font-mono tabular-nums text-[15px] text-st-hi text-center w-[60px] disabled:cursor-not-allowed"
            aria-label={label}
          />
          {suffix && <span className="font-mono text-st-sec text-[11.5px]">{suffix}</span>}
        </div>

        {/* Proportional bar */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="relative h-2 bg-st-stroke rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-200"
              style={{
                width: `${Math.min(100, (value / barMax) * 100)}%`,
                background: barColor,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-st-dim font-mono">
            <span>
              {prefix ?? ''}
              {min}
              {suffix ?? ''}
            </span>
            <span>
              {prefix ?? ''}
              {barMax / 2}
              {suffix ?? ''}
            </span>
            <span>
              {prefix ?? ''}
              {barMax}
              {suffix ?? ''}
            </span>
          </div>
        </div>
      </div>

      {error && <p className="mt-1.5 text-[11.5px] text-st-danger">{error}</p>}
      {children}
    </div>
  );
}

// ── SalesBonusWeight slider ───────────────────────────────────────────────

interface SalesSliderProps {
  value: number;
  original: number;
  readOnly: boolean;
  error?: string;
  onChange: (v: number) => void;
}

function SalesSlider({ value, original, readOnly, error, onChange }: SalesSliderProps) {
  const isDirty = Math.abs(value - original) > 0.0001;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor="sales-bonus-weight" className="text-[13px] text-st-hi font-medium">
          Importance des ventes
        </label>
        {isDirty && !readOnly && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill bg-st-emerald/10 border border-st-emerald/30 text-st-emerald-glow text-[10.5px] font-mono">
            ● modifié
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-st-sec leading-[1.55] mb-3">
        0 = les ventes sont ignorées, 1 = impact maximal sur la distribution.
      </p>

      <input
        id="sales-bonus-weight"
        type="range"
        min="0"
        max="1"
        step="0.01"
        disabled={readOnly}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="dist-slider mb-1"
        aria-label="Importance des ventes"
      />
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-st-sec">Ventes ignorées</span>
        <span className="font-mono tabular-nums text-[14px] text-st-indigo-glow font-medium">
          {value.toFixed(2)}
        </span>
        <span className="text-st-sec">Impact maximal</span>
      </div>
      {error && <p className="mt-1.5 text-[11.5px] text-st-danger">{error}</p>}
      <p className="mt-2 text-[11px] text-st-dim">
        Le bonus de ventes s&apos;applique uniquement aux rôles vendeurs&nbsp;: SERVER et BARTENDER.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function DistributionGuardrailsCard({
  config,
  original,
  onChange,
  readOnly,
  errors,
}: GuardrailsCardProps) {
  const activeRolesCount = Object.values(config.roleCoefficients).filter((v) => v >= 0.1).length;
  const mathBroken = config.maxSharePct * activeRolesCount < 100;
  const minRequiredStaff = Math.ceil(100 / config.maxSharePct);
  const capWarning = config.maxSharePct < 20;

  return (
    <section className="bg-st-card border border-st-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-st-border">
        <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-st-raised flex items-center justify-center">
          <ShieldCheck size={14} className="text-st-pri" />
        </div>
        <div>
          <p className="st-eyebrow text-st-sec mb-0.5">Section 3</p>
          <h2 className="font-display text-[20px] text-st-hi leading-tight">
            Règles financières <em className="italic text-st-sec">&amp; garde-fous</em>
          </h2>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-6">
        {/* Minimum garanti par heure */}
        <NumericField
          label="Minimum garanti par heure"
          hint="Garantit un montant minimal aux employés selon leurs heures travaillées."
          value={config.minPerHour}
          original={original.minPerHour}
          min={0}
          max={50}
          step={0.25}
          prefix="$"
          suffix="/h"
          barColor="linear-gradient(90deg, var(--st-emerald-dim, #059669), var(--st-emerald-glow, #34D399))"
          barMax={50}
          readOnly={readOnly}
          error={errors.minPerHour}
          onChange={(v) => onChange('minPerHour', v)}
        >
          <p className="mt-2 text-[11px] text-st-dim">
            Un employé qui travaille 8 h aura un minimum garanti de{' '}
            <span className="text-st-emerald-glow font-mono font-medium">
              {(config.minPerHour * 8).toFixed(2)} $
            </span>
            .
          </p>
        </NumericField>

        <div className="h-px bg-st-border" />

        {/* Plafond maximum par employé */}
        <NumericField
          label="Part maximale par employé"
          hint="Empêche un seul employé de recevoir une part trop importante du pool."
          value={config.maxSharePct}
          original={original.maxSharePct}
          min={1}
          max={100}
          step={1}
          suffix="%"
          barColor="linear-gradient(90deg, var(--st-gold-dim, #B8884F), var(--st-gold, #D4A574))"
          barMax={100}
          readOnly={readOnly}
          error={errors.maxSharePct}
          onChange={(v) => onChange('maxSharePct', Math.round(v))}
        >
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-st-dim">
              Pour un pool de 1&nbsp;000 $, un plafond de {config.maxSharePct}% limite chaque
              employé à{' '}
              <span className="text-st-gold font-mono font-medium">
                {(1000 * (config.maxSharePct / 100)).toFixed(2)} $
              </span>{' '}
              maximum.
            </p>
            <p className="text-[11px] text-st-dim">
              Nombre minimum d&apos;employés requis :{' '}
              <span className="font-mono text-st-pri">{minRequiredStaff}</span>
            </p>
          </div>

          {mathBroken && (
            <div className="mt-3 flex gap-2.5 items-start p-2.5 rounded-sm bg-st-danger/8 border border-st-danger/30">
              <AlertTriangle size={13} className="text-st-danger mt-0.5 flex-shrink-0" />
              <p className="text-[11.5px] text-st-hi leading-relaxed">
                <strong className="text-st-danger">Configuration impossible :</strong>{' '}
                {config.maxSharePct}% × {activeRolesCount} rôles actifs ={' '}
                {config.maxSharePct * activeRolesCount}% (doit être ≥ 100%). Augmentez le plafond ou
                réduisez les rôles inactifs.
              </p>
            </div>
          )}

          {capWarning && !mathBroken && (
            <div className="mt-3 flex gap-2.5 items-start p-2.5 rounded-sm bg-st-warn/8 border border-st-warn/30">
              <AlertTriangle size={13} className="text-st-warn mt-0.5 flex-shrink-0" />
              <p className="text-[11.5px] text-st-pri leading-relaxed">
                Un plafond trop bas peut rendre la distribution impossible si le nombre
                d&apos;employés est insuffisant.
              </p>
            </div>
          )}
        </NumericField>

        <div className="h-px bg-st-border" />

        {/* Poids des ventes */}
        <SalesSlider
          value={config.salesBonusWeight}
          original={original.salesBonusWeight}
          readOnly={readOnly}
          error={errors.salesBonusWeight}
          onChange={(v) => onChange('salesBonusWeight', v)}
        />
      </div>
    </section>
  );
}
