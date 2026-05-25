'use client';

import Link from 'next/link';
import { Lock, Receipt } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { LiveShift } from '../../../types/dashboard';

const SHIFT_TYPE_LABEL: Record<string, string> = {
  BREAKFAST: 'Matin',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
  LATE_NIGHT: 'Service tardif',
};

// 30-min rhythm bars — simulated pulse pattern
const RHYTHM = [12, 18, 26, 41, 58, 72, 65, 48, 38, 30, 22, 15];

function RhythmBar({ value, index }: { value: number; index: number }) {
  const pct = Math.max(8, (value / 80) * 100);
  const opacity = index <= 6 ? 50 + index * 7 : 50 + (12 - index) * 7;
  return (
    <span
      className="flex-1 min-h-[2px] rounded-[2px] transition-all"
      style={{
        height: `${pct}%`,
        background: `color-mix(in oklch, var(--st-indigo-glow) ${opacity}%, transparent)`,
      }}
    />
  );
}

interface TonightHeroProps {
  shift: LiveShift;
}

export function TonightHero({ shift }: TonightHeroProps) {
  const pool = shift.liveOrdersTotal;
  const tips = shift.tipsEstimated;

  return (
    <div
      className="relative rounded-[14px] border border-st-border overflow-hidden isolate mb-3.5"
      style={{
        background:
          'linear-gradient(135deg, var(--st-d-1) 0%, var(--st-d-1) 60%, color-mix(in oklch, var(--st-indigo) 8%, var(--st-d-1)) 100%)',
      }}
    >
      {/* Glow overlay */}
      <div
        className="absolute inset-[-1px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(900px 220px at -10% 110%, rgba(99,102,241,.10), transparent 60%), radial-gradient(600px 180px at 110% -20%, rgba(212,165,116,.06), transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* Responsive grid: 1-col mobile → 2-col tablet → 3-col desktop */}
      <style>{`
        @media (min-width: 768px)  { .hero-inner { grid-template-columns: 1.4fr 1fr !important; } }
        @media (min-width: 1100px) { .hero-inner { grid-template-columns: 1.4fr 1fr 1fr !important; } }
      `}</style>
      <div className="hero-inner p-4 sm:p-6 grid gap-6" style={{ gridTemplateColumns: '1fr' }}>
        {/* ── Left: pool + progress + CTAs ───────────────────────────── */}
        <div>
          {/* Status chips */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-medium"
              style={{
                background: 'rgba(99,102,241,.12)',
                border: '1px solid rgba(99,102,241,.3)',
                color: 'var(--st-indigo-glow)',
              }}
            >
              <span
                className="w-[5px] h-[5px] rounded-full animate-pulse"
                style={{ background: 'var(--st-indigo-glow)' }}
              />
              Service en cours
            </span>
            <span className="font-mono text-[10.5px]" style={{ color: 'var(--st-d-6)' }}>
              {SHIFT_TYPE_LABEL[shift.type] ?? shift.type} · {shift.startTime} → {shift.endTime}
            </span>
          </div>

          {/* Eyebrow */}
          <p
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
            style={{ color: 'var(--st-d-7)' }}
          >
            Cagnotte en direct · ce soir
          </p>

          {/* Money */}
          <div className="mt-1.5 mb-1">
            <span
              className="font-mono font-medium tracking-[-0.02em] tabular-nums leading-none"
              style={{ fontSize: 52, color: 'var(--st-gold)' }}
            >
              <span style={{ fontSize: 28, opacity: 0.55, marginRight: 3 }}>$</span>
              {Math.floor(pool).toLocaleString('fr-FR')}
              <span style={{ fontSize: 28, opacity: 0.55 }}>
                .{String(pool.toFixed(2).split('.')[1])}
              </span>
            </span>
          </div>

          {/* Stats row */}
          <div
            className="flex flex-wrap items-center gap-3 mt-1 text-[12px]"
            style={{ color: 'var(--st-d-7)' }}
          >
            <span>
              <span className="font-mono font-medium" style={{ color: 'var(--st-d-9)' }}>
                {shift.liveOrdersCount}
              </span>{' '}
              tickets
            </span>
            <span className="w-[3px] h-[3px] rounded-full bg-st-muted" />
            <span>
              ~
              <span className="font-mono" style={{ color: 'var(--st-d-9)' }}>
                ${tips.toFixed(0)}
              </span>{' '}
              tips estimés
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-4 max-w-sm">
            <div
              className="flex justify-between text-[10.5px] mb-1.5 font-mono"
              style={{ color: 'var(--st-d-6)' }}
            >
              <span>{shift.startTime}</span>
              <span style={{ color: 'var(--st-indigo-glow)' }}>
                {shift.progressPct.toFixed(0)}% écoulé
              </span>
              <span>{shift.endTime}</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(shift.progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progression du service : ${shift.progressPct.toFixed(0)}%`}
              className="h-1 rounded-[2px] relative overflow-hidden"
              style={{ background: 'var(--st-d-3)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-[2px] transition-all duration-700"
                style={{
                  width: `${shift.progressPct}%`,
                  background: 'linear-gradient(90deg, var(--st-indigo), var(--st-indigo-glow))',
                }}
              />
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              href={`/dashboard/shifts/${shift.id}`}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13.5px] font-medium text-white transition-colors',
              )}
              style={{
                background: 'var(--st-emerald)',
                boxShadow: '0 8px 24px -8px rgba(16,185,129,.45)',
              }}
            >
              <Lock size={13} />
              Clôturer le service
            </Link>
            <Link
              href={`/dashboard/shifts/${shift.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13.5px] border transition-colors hover:bg-st-raised"
              style={{
                color: 'var(--st-d-9)',
                borderColor: 'var(--st-d-4)',
              }}
            >
              <Receipt size={13} />
              Voir les tickets
            </Link>
          </div>
        </div>

        {/* ── Middle: team on duty ────────────────────────────────────── */}
        <div
          className="pl-0 pt-4 border-t sm:pt-0 sm:pl-7 sm:border-t-0 sm:border-l"
          style={{ borderColor: 'var(--st-d-3)' }}
        >
          <p
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium mb-2"
            style={{ color: 'var(--st-d-7)' }}
          >
            Équipe en service
          </p>
          <div className="flex items-baseline gap-1.5 mb-3.5">
            <span
              className="font-mono font-medium tabular-nums"
              style={{ fontSize: 26, color: 'var(--st-d-9)' }}
            >
              {shift.teamCount}
            </span>
            <span className="text-[12px]" style={{ color: 'var(--st-d-6)' }}>
              présents
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {shift.team.slice(0, 5).map((m) => {
              const initials = `${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`;
              return (
                <div key={m.id} className="flex items-center gap-2.5">
                  <span
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg, #4F46E5, #818CF8)' }}
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                  <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--st-d-8)' }}>
                    {m.firstName} {m.lastName}
                  </span>
                  <span
                    className="text-[10px] font-mono uppercase shrink-0"
                    style={{ color: 'var(--st-d-6)' }}
                  >
                    {m.role}
                  </span>
                </div>
              );
            })}
            {shift.teamCount > 5 && (
              <p className="text-[11px]" style={{ color: 'var(--st-d-6)' }}>
                + {shift.teamCount - 5} autres
              </p>
            )}
          </div>
        </div>

        {/* ── Right: service rhythm ──────────────────────────────────── */}
        <div className="hidden lg:block pl-7 border-l" style={{ borderColor: 'var(--st-d-3)' }}>
          <div className="flex items-center justify-between">
            <p
              className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium"
              style={{ color: 'var(--st-d-7)' }}
            >
              Rythme · 30 min
            </p>
            <span className="text-[10.5px] font-mono" style={{ color: 'var(--st-gold)' }}>
              PIC 20:30
            </span>
          </div>
          <div className="flex items-end gap-[3px] h-9 mt-3.5">
            {RHYTHM.map((v, i) => (
              <RhythmBar key={i} value={v} index={i} />
            ))}
          </div>
          <div
            className="flex justify-between text-[9.5px] font-mono mt-2"
            style={{ color: 'var(--st-d-6)' }}
          >
            <span>{shift.startTime}</span>
            <span>20:30</span>
            <span>{shift.endTime}</span>
          </div>
          <div
            className="mt-4 p-3 rounded-[6px] flex gap-2.5 items-start"
            style={{
              background: 'var(--st-d-2)',
              border: '1px solid var(--st-d-3)',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--st-indigo-glow)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
            </svg>
            <p className="text-[11.5px] leading-[1.5]" style={{ color: 'var(--st-d-8)' }}>
              Service à <strong style={{ color: 'var(--st-d-9)' }}>+18%</strong> vs. samedi dernier
              — vous êtes sur une bonne soirée.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
