'use client';

import { Zap, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/cn';

interface ModeSelectorProps {
  readOnly: boolean;
}

type ModeOption = {
  value: string;
  label: string;
  desc: string;
  available: boolean;
};

const MODES: ModeOption[] = [
  {
    value: 'RULES_ONLY',
    label: 'Règles métier uniquement',
    desc: 'Distribution déterministe basée sur vos coefficients et garde-fous.',
    available: true,
  },
  {
    value: 'ML_ASSISTED',
    label: 'ML assisté',
    desc: 'Le modèle suggère des ajustements ; vous validez avant application.',
    available: false,
  },
  {
    value: 'ML_FULL',
    label: 'ML complet',
    desc: "Le modèle apprend et s'applique automatiquement sur chaque shift.",
    available: false,
  },
];

export function DistributionModeSelector({ readOnly }: ModeSelectorProps) {
  // mode is always RULES_ONLY — ML options are display-only with coming-soon badge
  return (
    <section className="bg-st-card border border-st-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-st-border">
        <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-st-raised flex items-center justify-center">
          <Zap size={14} className="text-st-pri" />
        </div>
        <div>
          <p className="st-eyebrow text-st-sec mb-0.5">Section 1</p>
          <h2 className="font-display text-[20px] text-st-hi leading-tight">Mode de calcul</h2>
        </div>
      </div>

      {/* Mode cards */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODES.map((m) => {
          const isSelected = m.value === 'RULES_ONLY';
          const isDisabled = !m.available || readOnly;

          return (
            <div
              key={m.value}
              aria-pressed={isSelected}
              role="button"
              tabIndex={isSelected ? 0 : -1}
              className={cn(
                'flex flex-col p-4 rounded-md text-left border transition-all duration-150',
                isSelected
                  ? 'border-st-indigo bg-gradient-to-br from-st-raised to-st-indigo/5 shadow-[0_0_0_1px_theme(colors.st.indigo)]'
                  : 'bg-st-raised border-st-border',
                !m.available && 'opacity-55 cursor-not-allowed',
              )}
            >
              {/* Top row: icon + badge or check */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className={cn(
                    'text-lg leading-none',
                    isSelected ? 'text-st-indigo-glow' : 'text-st-sec',
                  )}
                >
                  {m.value === 'RULES_ONLY' ? '◆' : m.value === 'ML_ASSISTED' ? '✦' : '★'}
                </span>

                {isSelected && <CheckCircle2 size={16} className="text-st-indigo-glow" />}
                {!m.available && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-pill text-[9.5px] font-medium font-mono bg-st-gold/10 text-st-gold border border-st-gold/30">
                    Bientôt
                  </span>
                )}
              </div>

              <p
                className={cn(
                  'text-[13.5px] font-medium mb-1.5',
                  isSelected ? 'text-st-hi' : 'text-st-pri',
                )}
              >
                {m.label}
              </p>
              <p className="text-[11.5px] text-st-sec leading-[1.45]">{m.desc}</p>

              {isSelected && !isDisabled && (
                <p className="mt-2 text-[10.5px] font-mono text-st-indigo-glow">Mode actif</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div className="px-5 pb-4">
        <p className="text-[11px] text-st-dim font-mono">
          Les modes ML seront disponibles une fois votre modèle entraîné sur au moins 30 jours de
          données.
        </p>
      </div>
    </section>
  );
}
