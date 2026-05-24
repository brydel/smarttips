'use client';

import { cn } from '../../../lib/cn';
import type { ShiftType } from '../../../types/shift';

// ── Config ─────────────────────────────────────────────────────────────────────

export interface ShiftTypeCfg {
  label: string;
  shortLabel: string;
  icon: string;
  cssClass: string;
}

export const SHIFT_TYPE_CFG: Record<ShiftType, ShiftTypeCfg> = {
  BREAKFAST: {
    label: 'Petit-déjeuner',
    shortLabel: 'BREAKFAST',
    icon: '◐',
    cssClass: 'shifts-type-BREAKFAST',
  },
  LUNCH: { label: 'Déjeuner', shortLabel: 'LUNCH', icon: '☀', cssClass: 'shifts-type-LUNCH' },
  DINNER: { label: 'Dîner', shortLabel: 'DINNER', icon: '◑', cssClass: 'shifts-type-DINNER' },
  LATE_NIGHT: {
    label: 'Service tardif',
    shortLabel: 'LATE',
    icon: '☾',
    cssClass: 'shifts-type-LATE_NIGHT',
  },
};

/** Backward-compat label map (used by other components that still import from shift-type-badge). */
export const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
  LATE_NIGHT: 'Service tardif',
};

interface ShiftTypeChipProps {
  type: ShiftType;
  size?: 'sm' | 'md';
  className?: string;
}

export function ShiftTypeChip({ type, size = 'md', className }: ShiftTypeChipProps) {
  const cfg = SHIFT_TYPE_CFG[type];
  const isSm = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] font-sans font-medium whitespace-nowrap',
        cfg.cssClass,
        className,
      )}
      style={{
        padding: isSm ? '3px 9px 3px 7px' : '5px 11px 5px 9px',
        borderRadius: '6px',
        background: 'var(--type-g)',
        color: 'var(--type-c)',
        border: '1px solid color-mix(in srgb, var(--type-c) 25%, transparent)',
        fontSize: isSm ? 11 : 12,
        letterSpacing: '-0.005em',
      }}
    >
      <span style={{ fontSize: isSm ? 12 : 13, lineHeight: 1 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
