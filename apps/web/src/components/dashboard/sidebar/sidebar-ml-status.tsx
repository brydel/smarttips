'use client';

import { memo } from 'react';
import { Brain, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/cn';

interface SidebarMLStatusCardProps {
  /** Confidence score 0–1, or null if unavailable yet. */
  confidence: number | null;
  /** Friendly impact line under the headline. */
  impactLabel: string | null;
}

function formatPct(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  return `${Math.round(clamped * 100)} %`;
}

function SidebarMLStatusCardImpl({ confidence, impactLabel }: SidebarMLStatusCardProps) {
  const hasConfidence = typeof confidence === 'number' && Number.isFinite(confidence);
  const pct = hasConfidence ? formatPct(confidence as number) : '—';
  const barWidth = hasConfidence ? formatPct(confidence as number) : '0%';

  return (
    <div
      className={cn(
        'st-sidebar-tone-card relative overflow-hidden rounded-lg border border-[#6366F1]/30 p-3',
        'bg-gradient-to-br from-[#312E81]/70 via-[#1E1B4B]/60 to-[#0F1422]/0',
        'shadow-[0_8px_28px_-12px_rgba(99,102,241,0.45)]',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#A855F7]/15 blur-2xl"
      />
      <div className="relative flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#4338CA]/30 text-[#C4B5FD]">
          <Brain width={14} height={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9.5px] uppercase tracking-widest text-[#C4B5FD]">
            Modèle ML
          </p>
          <p className="truncate font-sans text-[12px] font-semibold text-st-hi">SmartTips Brain</p>
        </div>
      </div>

      <div className="relative mt-2.5 flex items-baseline justify-between gap-2">
        <span className="font-display text-2xl leading-none tracking-tight text-[#C4B5FD]">
          {pct}
        </span>
        <span className="font-sans text-[10px] uppercase tracking-wider text-st-dim">
          Confiance
        </span>
      </div>

      <div className="relative mt-2 h-1 overflow-hidden rounded-pill bg-white/5">
        <div
          className={cn(
            'h-full rounded-pill bg-gradient-to-r from-[#A855F7] to-[#6366F1]',
            'transition-[width] duration-500 ease-out motion-reduce:transition-none',
          )}
          style={{ width: barWidth }}
          role="progressbar"
          aria-valuenow={hasConfidence ? Math.round((confidence as number) * 100) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Confiance du modèle ML"
        />
      </div>

      {impactLabel && (
        <p className="relative mt-2 flex items-center gap-1.5 font-sans text-[10.5px] text-st-sec">
          <Sparkles width={10} height={10} className="text-st-gold-glow" aria-hidden="true" />
          <span className="truncate">{impactLabel}</span>
        </p>
      )}
    </div>
  );
}

export const SidebarMLStatusCard = memo(SidebarMLStatusCardImpl);
