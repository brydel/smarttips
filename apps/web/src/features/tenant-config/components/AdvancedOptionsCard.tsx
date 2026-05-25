'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type {
  DistributionConfig,
  DistributionValidationErrors,
  ConfigEditableKey,
} from '../types/tenant-config.types';

interface AdvancedOptionsCardProps {
  config: DistributionConfig;
  original: DistributionConfig;
  onChange: (key: ConfigEditableKey, value: boolean | number) => void;
  readOnly: boolean;
  errors: DistributionValidationErrors;
}

// ── Toggle switch (accessible) ────────────────────────────────────────────

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  readOnly: boolean;
  isDirty: boolean;
}

function Toggle({ id, label, description, checked, onChange, readOnly, isDirty }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="text-[13px] text-st-hi font-medium cursor-pointer">
            {label}
          </label>
          {isDirty && !readOnly && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill bg-st-emerald/10 border border-st-emerald/30 text-st-emerald-glow text-[10px] font-mono">
              ● modifié
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-st-sec leading-relaxed mt-0.5">{description}</p>
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={readOnly}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative flex-shrink-0 w-9 h-5 rounded-full border transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          checked ? 'bg-st-indigo border-st-indigo' : 'bg-st-stroke border-st-border',
        )}
        aria-label={label}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all duration-200',
            checked ? 'translate-x-4 bg-white' : 'translate-x-0 bg-st-sec',
          )}
        />
      </button>
    </div>
  );
}

// ── ColdStart numeric input ───────────────────────────────────────────────

interface ColdStartInputProps {
  value: number;
  original: number;
  readOnly: boolean;
  error?: string;
  onChange: (v: number) => void;
}

function ColdStartInput({ value, original, readOnly, error, onChange }: ColdStartInputProps) {
  const [local, setLocal] = useState(String(value));
  const isDirty = value !== original;

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  const commit = useCallback(() => {
    const n = parseInt(local, 10);
    if (isNaN(n)) {
      setLocal(String(value));
      return;
    }
    onChange(Math.max(1, Math.min(365, n)));
  }, [local, value, onChange]);

  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] text-st-hi font-medium">Seuil de cold start ML</p>
          {isDirty && !readOnly && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill bg-st-emerald/10 border border-st-emerald/30 text-st-emerald-glow text-[10px] font-mono">
              ● modifié
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-st-sec leading-relaxed mt-0.5">
          Jours minimum de données avant que le modèle puisse proposer des ajustements (1–365).
        </p>
        {error && <p className="mt-1 text-[11px] text-st-danger">{error}</p>}
      </div>

      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-sm border px-2.5 py-1.5 min-w-[100px]',
          'transition-colors duration-150',
          readOnly ? 'opacity-60 bg-st-raised border-st-border' : 'bg-st-raised border-st-border',
          !readOnly &&
            'hover:border-st-muted focus-within:border-st-indigo focus-within:ring-1 focus-within:ring-st-indigo/20',
          error && 'border-st-danger',
        )}
      >
        <input
          type="number"
          min={1}
          max={365}
          step={1}
          disabled={readOnly}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="bg-transparent border-0 outline-none font-mono tabular-nums text-[14px] text-st-hi text-center w-[48px] disabled:cursor-not-allowed"
          aria-label="Seuil cold start (jours)"
        />
        <span className="text-[11px] text-st-sec font-mono">j</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function AdvancedOptionsCard({
  config,
  original,
  onChange,
  readOnly,
  errors,
}: AdvancedOptionsCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-st-card border border-st-border rounded-lg overflow-hidden">
      {/* Header — acts as accordion trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-start gap-3 px-5 py-4 text-left transition-colors',
          'hover:bg-st-raised/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-st-indigo',
          open && 'border-b border-st-border',
        )}
        aria-expanded={open}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-st-gold/10 flex items-center justify-center">
          <Sparkles size={14} className="text-st-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="st-eyebrow text-st-gold mb-0.5">Section 4 · Options avancées</p>
          <h2 className="font-display text-[20px] text-st-hi leading-tight">
            Fonctionnalités avancées
          </h2>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            'text-st-dim self-center transition-transform duration-200 flex-shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="p-5 flex flex-col gap-5">
          {/* Info note */}
          <div className="flex gap-2.5 p-3 rounded-sm bg-st-gold/6 border border-st-gold/20">
            <Sparkles size={12} className="text-st-gold mt-0.5 flex-shrink-0" />
            <p className="text-[11.5px] text-st-sec leading-relaxed">
              Ces options préparent les futures fonctionnalités d&apos;analyse, de fairness et de
              ML. Elles sont sauvegardées correctement même si leur impact est limité en mode
              RULES_ONLY.
            </p>
          </div>

          {/* Tenure bonus */}
          <Toggle
            id="tenure-bonus"
            label="Bonus d'ancienneté"
            description="Les employés avec plus de 12 mois dans l'équipe reçoivent un multiplicateur supplémentaire."
            checked={config.tenureBonusEnabled}
            onChange={(v) => onChange('tenureBonusEnabled', v)}
            readOnly={readOnly}
            isDirty={config.tenureBonusEnabled !== original.tenureBonusEnabled}
          />

          <div className="h-px bg-st-border" />

          {/* Fairness audit */}
          <Toggle
            id="fairness-audit"
            label="Audit de fairness automatique"
            description="Alerte si l'écart-type de distribution entre employés dépasse votre seuil de tolérance."
            checked={config.fairnessAuditEnabled}
            onChange={(v) => onChange('fairnessAuditEnabled', v)}
            readOnly={readOnly}
            isDirty={config.fairnessAuditEnabled !== original.fairnessAuditEnabled}
          />

          <div className="h-px bg-st-border" />

          {/* Cold start threshold */}
          <ColdStartInput
            value={config.coldStartThreshold}
            original={original.coldStartThreshold}
            readOnly={readOnly}
            error={errors.coldStartThreshold}
            onChange={(v) => onChange('coldStartThreshold', v)}
          />
        </div>
      )}
    </section>
  );
}
