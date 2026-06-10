'use client';

import { memo, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { TONE_TOKENS, type SidebarCardData } from './types';

interface SidebarCardProps extends SidebarCardData {
  isActive: boolean;
  onNavigate?: () => void;
  children?: ReactNode;
}

/** Format the progress fraction → "65 %", clamped & rounded. */
function formatProgress(value: number): string {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return `${Math.round(pct)} %`;
}

function SidebarCardImpl({
  href,
  label,
  caption,
  icon: Icon,
  tone,
  metric,
  hint,
  badge,
  progress,
  isActive,
  onNavigate,
  children,
}: SidebarCardProps) {
  const tokens = TONE_TOKENS[tone];

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'st-sidebar-tone-card group relative block rounded-lg border p-3 outline-none',
        'transition-[box-shadow,transform,border-color] duration-200 ease-out',
        'focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
        'motion-safe:group-hover:-translate-y-px motion-reduce:transform-none',
        tokens.surface,
        tokens.border,
        tokens.ringHover,
        isActive && tokens.activeRing,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            'backdrop-blur-sm',
            tokens.iconBg,
            tokens.iconText,
          )}
          aria-hidden="true"
        >
          <Icon width={16} height={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-sans text-[13px] font-semibold leading-tight text-st-hi">
              {label}
            </p>
            {badge ? (
              <span
                className={cn(
                  'shrink-0 rounded-pill border border-white/10 bg-black/30 px-1.5 py-0.5',
                  'font-mono text-[9.5px] tracking-wide text-white/85',
                )}
              >
                {badge}
              </span>
            ) : (
              <ChevronRight
                size={12}
                className="shrink-0 text-st-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-st-pri"
              />
            )}
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-st-dim">
            {caption}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              'font-display text-xl leading-none tracking-tight',
              metric ? tokens.accent : 'text-st-dim',
            )}
          >
            {metric ?? '—'}
          </p>
          {hint && <p className="mt-1.5 truncate font-sans text-[10.5px] text-st-sec">{hint}</p>}
        </div>
        {children}
      </div>

      {typeof progress === 'number' && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-pill bg-white/5">
          <div
            className={cn(
              'h-full rounded-pill bg-current',
              'transition-[width] duration-500 ease-out motion-reduce:transition-none',
              tokens.accent,
            )}
            style={{ width: formatProgress(progress) }}
            role="progressbar"
            aria-valuenow={Math.round(Math.max(0, Math.min(1, progress)) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label} progression`}
          />
        </div>
      )}
    </Link>
  );
}

export const SidebarCard = memo(SidebarCardImpl);
