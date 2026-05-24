'use client';

import { cn } from '../../../lib/cn';
import type { ShiftStatus } from '../../../types/shift';

// ── Status config ──────────────────────────────────────────────────────────────

interface StatusCfg {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
  dotBg: string;
  pulse: boolean;
}

const CONFIG: Record<ShiftStatus, StatusCfg> = {
  PLANNED: {
    label: 'Planifié',
    color: '#8892B0',
    bg: '#1B2236',
    borderColor: 'rgba(136,146,176,.25)',
    dotBg: '#5A6485',
    pulse: false,
  },
  IN_PROGRESS: {
    label: 'En service',
    color: '#818CF8',
    bg: 'rgba(99,102,241,.12)',
    borderColor: 'rgba(129,140,248,.33)',
    dotBg: '#818CF8',
    pulse: true,
  },
  CLOSED: {
    label: 'Clôturé',
    color: '#34D399',
    bg: 'rgba(16,185,129,.10)',
    borderColor: 'rgba(52,211,153,.28)',
    dotBg: '#10B981',
    pulse: false,
  },
  CANCELLED: {
    label: 'Annulé',
    color: '#EF4444',
    bg: 'rgba(239,68,68,.10)',
    borderColor: 'rgba(239,68,68,.25)',
    dotBg: '#EF4444',
    pulse: false,
  },
};

interface ShiftStatusBadgeProps {
  status: ShiftStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function ShiftStatusBadge({ status, size = 'md', className }: ShiftStatusBadgeProps) {
  const cfg = CONFIG[status] ?? CONFIG.PLANNED;
  const isSm = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] font-sans font-medium whitespace-nowrap',
        className,
      )}
      style={{
        padding: isSm ? '3px 8px' : '5px 10px',
        borderRadius: '999px',
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.borderColor}`,
        fontSize: isSm ? 10.5 : 11.5,
        letterSpacing: '-0.005em',
      }}
    >
      <span
        className={cn('inline-block rounded-full', cfg.pulse && 'shifts-pulse')}
        style={{
          width: 6,
          height: 6,
          background: cfg.dotBg,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}
