'use client';

import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import type { TomorrowShift } from '../../../types/dashboard';

const SHIFT_TYPE_LABEL: Record<string, string> = {
  BREAKFAST: 'Matin',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
  LATE_NIGHT: 'Service tardif',
};

const SHIFT_TYPE_COLOR: Record<string, string> = {
  BREAKFAST: '#D4A574', // gold
  LUNCH: '#F59E0B', // amber
  DINNER: '#6366F1', // indigo
  LATE_NIGHT: '#8892B0', // muted
};

/** Deterministic avatar color per slot index — matches design's overlapping circles */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4F46E5, #818CF8)',
  'linear-gradient(135deg, #D4A574, #E8C49A)',
  'linear-gradient(135deg, #10B981, #34D399)',
  'linear-gradient(135deg, #5A6485, #8892B0)',
];

/** Overlapping avatar stack — shows up to `max` circles + overflow badge */
function AvatarStack({ count, max = 3 }: { count: number; max?: number }) {
  if (count === 0) return null;
  const shown = Math.min(count, max);
  const overflow = count - shown;
  return (
    <div className="flex items-center">
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] font-bold text-white"
          style={{
            background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
            borderColor: 'var(--st-card)',
            marginLeft: i === 0 ? 0 : -8,
          }}
          aria-hidden="true"
        />
      ))}
      {overflow > 0 && (
        <span
          className="w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono text-[8px]"
          style={{
            background: 'var(--st-d-3)',
            borderColor: 'var(--st-card)',
            color: 'var(--st-d-7)',
            marginLeft: -8,
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

interface TomorrowStripProps {
  shifts: TomorrowShift[];
  dateLabel?: string;
}

export function TomorrowStrip({ shifts, dateLabel = 'demain' }: TomorrowStripProps) {
  if (shifts.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 py-2 mb-3">
          <span
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium whitespace-nowrap"
            style={{ color: 'var(--st-d-7)' }}
          >
            {dateLabel}
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--st-d-3)' }} />
          <Link
            href="/dashboard/shifts"
            className="text-[11.5px] hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}
          >
            Planifier →
          </Link>
        </div>
        <Link
          href="/dashboard/shifts"
          className="flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-st-border text-[12.5px] py-6 hover:border-st-muted hover:text-st-hi transition-colors"
          style={{ color: 'var(--st-d-7)', textDecoration: 'none' }}
        >
          <Plus size={13} />
          Planifier un shift
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 py-2 mb-3">
        <span
          className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium whitespace-nowrap"
          style={{ color: 'var(--st-d-7)' }}
        >
          {dateLabel}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--st-d-3)' }} />
        <Link
          href="/dashboard/shifts"
          className="text-[11.5px] hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{ color: 'var(--st-indigo-glow)', textDecoration: 'none' }}
        >
          Planifier →
        </Link>
      </div>

      {/* Responsive card grid */}
      <style>{`
        @media (min-width: 640px)  { .tomorrow-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (min-width: 900px)  { .tomorrow-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (min-width: 1200px) { .tomorrow-grid { grid-template-columns: repeat(${Math.min(shifts.length + 1, 4)}, 1fr) !important; } }
      `}</style>
      <div className="tomorrow-grid grid gap-3" style={{ gridTemplateColumns: '1fr' }}>
        {shifts.map((s) => {
          const typeColor = SHIFT_TYPE_COLOR[s.type] ?? '#6366F1';
          return (
            <Link
              key={s.id}
              href={`/dashboard/shifts/${s.id}`}
              aria-label={`Shift ${SHIFT_TYPE_LABEL[s.type] ?? s.type} — ${s.startTime} → ${s.endTime}, ${s.staffCount} employé${s.staffCount > 1 ? 's' : ''}${s.isUnderstaffed ? ' (sous-effectif)' : ''}`}
              className="rounded-[10px] border border-st-border bg-st-card p-3.5 transition-all hover:border-st-muted hover:-translate-y-px relative overflow-hidden"
              style={{
                borderLeft: `3px solid ${typeColor}`,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {/* Understaffed top accent */}
              {s.isUnderstaffed && (
                <div
                  className="absolute top-[-1px] left-[-1px] right-[-1px] h-0.5 rounded-t-[10px]"
                  style={{ background: 'var(--st-warn)' }}
                  aria-hidden="true"
                />
              )}

              {/* Type + time */}
              <div className="flex items-center justify-between mb-2.5">
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill text-[10.5px] font-medium border"
                  style={{
                    background: `${typeColor}22`,
                    borderColor: `${typeColor}44`,
                    color: typeColor,
                  }}
                >
                  {SHIFT_TYPE_LABEL[s.type] ?? s.type}
                </span>
                <span className="font-mono text-[10.5px]" style={{ color: 'var(--st-d-6)' }}>
                  {s.startTime} → {s.endTime}
                </span>
              </div>

              {/* Avatar stack + staff count */}
              <div className="flex items-center gap-2.5 mb-2">
                <AvatarStack count={s.staffCount} max={3} />
                <span className="text-[12px]" style={{ color: 'var(--st-d-7)' }}>
                  <span className="font-mono font-medium" style={{ color: 'var(--st-d-9)' }}>
                    {s.staffCount}
                  </span>{' '}
                  employé{s.staffCount > 1 ? 's' : ''}
                </span>
              </div>

              {/* Alert or notes */}
              {s.isUnderstaffed ? (
                <div
                  className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: 'var(--st-warn)' }}
                >
                  <AlertTriangle size={11} />
                  Sous-effectif détecté
                </div>
              ) : s.notes ? (
                <p
                  className="text-[11.5px] leading-[1.4] line-clamp-2"
                  style={{ color: 'var(--st-d-7)' }}
                >
                  {s.notes}
                </p>
              ) : null}
            </Link>
          );
        })}

        {/* "Add shift" dashed card */}
        <Link
          href="/dashboard/shifts"
          className="flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-st-border text-[12.5px] p-3.5 min-h-[96px] hover:border-st-muted hover:text-st-hi transition-colors"
          style={{ color: 'var(--st-d-7)', textDecoration: 'none' }}
        >
          <Plus size={13} />
          Ajouter un shift
        </Link>
      </div>
    </div>
  );
}
