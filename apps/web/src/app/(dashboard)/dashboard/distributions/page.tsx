'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isValid, subDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Users, ChevronRight, ArrowRight, X } from 'lucide-react';

import { useShifts } from '../../../../hooks/use-shifts';
import {
  ShiftTypeChip,
  SHIFT_TYPE_CFG,
} from '../../../../components/dashboard/shifts/shift-type-chip';
import { ShiftStatusBadge } from '../../../../components/dashboard/shifts/shift-status-badge';
import type { Shift, ShiftStatus } from '../../../../types/shift';
import { cn } from '../../../../lib/cn';

// ── Helpers ────────────────────────────────────────────────────────────────────

function dateOnlyStr(raw: string): string {
  return raw.split('T')[0] ?? raw;
}

function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateGroup(raw: string): string {
  try {
    const d = parseISO(dateOnlyStr(raw));
    if (!isValid(d)) return '—';
    const s = format(d, 'EEEE d MMMM', { locale: fr });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return '—';
  }
}

function formatTime(raw: string): string {
  try {
    const d = parseISO(raw);
    return isValid(d) ? format(d, 'HH:mm') : '—';
  } catch {
    return '—';
  }
}

function daysBefore(n: number): string {
  const d = subDays(startOfDay(new Date()), n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Period filter ──────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'all';

function filterByPeriod(shifts: Shift[], period: Period): Shift[] {
  if (period === 'all') return shifts;
  const cutoff = period === 'week' ? daysBefore(7) : daysBefore(30);
  return shifts.filter((s) => dateOnlyStr(s.date) >= cutoff);
}

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | ShiftStatus;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DistributionsPage() {
  const router = useRouter();
  const { data: allShifts = [], isLoading, isError } = useShifts();
  const today = getLocalToday();

  const [period, setPeriod] = useState<Period>('month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('CLOSED');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build last 30 days grid for heatmap
  const heatmapDays = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => daysBefore(29 - i));
  }, []);

  // Shifts in current period
  const periodShifts = useMemo(() => filterByPeriod(allShifts, period), [allShifts, period]);

  // Shifts per day for heatmap
  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    allShifts.forEach((s) => {
      const d = dateOnlyStr(s.date);
      const arr = map.get(d) ?? [];
      arr.push(s);
      map.set(d, arr);
    });
    return map;
  }, [allShifts]);

  // Stats
  const stats = useMemo(() => {
    return {
      closed: periodShifts.filter((s) => s.status === 'CLOSED').length,
      inProgress: periodShifts.filter((s) => s.status === 'IN_PROGRESS').length,
      planned: periodShifts.filter((s) => s.status === 'PLANNED').length,
      total: periodShifts.length,
    };
  }, [periodShifts]);

  // Filtered + grouped shifts
  const grouped = useMemo(() => {
    let list = periodShifts;
    if (statusFilter !== 'all') list = list.filter((s) => s.status === statusFilter);
    if (selectedDate) list = list.filter((s) => dateOnlyStr(s.date) === selectedDate);

    const map = new Map<string, Shift[]>();
    list.forEach((s) => {
      const d = dateOnlyStr(s.date);
      const arr = map.get(d) ?? [];
      arr.push(s);
      map.set(d, arr);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, shifts]) => ({ date, shifts }));
  }, [periodShifts, statusFilter, selectedDate]);

  const handleShiftClick = useCallback(
    (shift: Shift) => {
      router.push(`/dashboard/shifts/${shift.id}/distribution`);
    },
    [router],
  );

  const toggleDate = useCallback((date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-st-bg">
      <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 max-w-[1400px] mx-auto flex flex-col gap-5">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-[38px] text-st-hi leading-[1.05]">
              Distributions{' '}
              <em className="italic" style={{ color: '#8892B0' }}>
                en attente.
              </em>
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[13px] text-st-sec">
              <span>
                <span className="font-mono text-st-gold">{stats.closed}</span> à distribuer
              </span>
              <Dot />
              <span>
                <span className="font-mono text-st-indigo-glow">{stats.inProgress}</span> en service
              </span>
              <Dot />
              <span>
                <span className="font-mono text-st-sec">{stats.planned}</span> planifiés
              </span>
            </div>
          </div>

          {/* Period pills */}
          <div
            className="flex gap-1 p-0.5 rounded-md shrink-0 self-start sm:self-auto"
            style={{ background: '#0F1422', border: '1px solid #252D45' }}
          >
            {(
              [
                ['week', 'Cette semaine'],
                ['month', 'Ce mois'],
                ['all', 'Tout'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={cn(
                  'px-3 py-1.5 rounded-sm text-[12px] font-medium transition-colors',
                  period === v ? 'bg-st-raised text-st-hi' : 'text-st-sec hover:text-st-hi',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <KpiCard label="À distribuer" value={stats.closed} sub={`shifts clôturés`} tone="gold" />
          <KpiCard label="Volume période" value={stats.total} sub="tous statuts" />
          <KpiCard label="En service" value={stats.inProgress} sub="shifts actifs" tone="indigo" />
          <KpiCard label="Planifiés" value={stats.planned} sub="à venir" tone="neutral" />
        </div>

        {/* ── Heatmap ── */}
        <Heatmap
          days={heatmapDays}
          shiftsByDay={shiftsByDay}
          today={today}
          selectedDate={selectedDate}
          onSelect={toggleDate}
        />

        {/* ── Status filter tabs ── */}
        <div className="flex flex-wrap items-center gap-2">
          <TabPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            Tous <Count n={periodShifts.length} />
          </TabPill>
          <TabPill
            active={statusFilter === 'CLOSED'}
            dotColor="#D4A574"
            onClick={() => setStatusFilter('CLOSED')}
          >
            À distribuer <Count n={stats.closed} />
          </TabPill>
          <TabPill
            active={statusFilter === 'IN_PROGRESS'}
            dotColor="#818CF8"
            onClick={() => setStatusFilter('IN_PROGRESS')}
          >
            En service <Count n={stats.inProgress} />
          </TabPill>
          <TabPill active={statusFilter === 'PLANNED'} onClick={() => setStatusFilter('PLANNED')}>
            Planifiés <Count n={stats.planned} />
          </TabPill>

          <span className="flex-1" />

          {/* Date filter indicator */}
          {selectedDate && (
            <span
              className="inline-flex items-center gap-2 text-[11.5px] px-3 py-1.5 rounded-pill"
              style={{
                background: 'rgba(99,102,241,.10)',
                border: '1px solid rgba(99,102,241,.3)',
                color: '#818CF8',
              }}
            >
              Filtré · <strong className="text-st-hi">{formatDateGroup(selectedDate)}</strong>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-st-dim hover:text-st-sec transition-colors ml-0.5"
                aria-label="Effacer le filtre de date"
              >
                <X size={11} />
              </button>
            </span>
          )}
        </div>

        {/* ── Loading / Error / Empty ── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-st-sec text-[13px]">
            <svg
              className="animate-spin mr-3 text-st-indigo"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Chargement des shifts…
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-16 text-st-danger text-[13px]">
            Impossible de charger les shifts. Rechargez la page.
          </div>
        )}

        {!isLoading && !isError && grouped.length === 0 && (
          <EmptyState statusFilter={statusFilter} selectedDate={selectedDate} />
        )}

        {/* ── Grouped shift list ── */}
        {!isLoading && !isError && grouped.length > 0 && (
          <div className="flex flex-col gap-3">
            {grouped.map(({ date, shifts }) => (
              <DateGroup key={date} date={date} shifts={shifts} onShiftClick={handleShiftClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Dot() {
  return <span className="inline-block w-1 h-1 rounded-full bg-st-stroke shrink-0" />;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  sub?: string;
  tone?: 'gold' | 'indigo' | 'emerald' | 'neutral';
}

function KpiCard({ label, value, sub, tone = 'neutral' }: KpiCardProps) {
  const valueColor =
    tone === 'gold'
      ? 'text-st-gold-glow'
      : tone === 'indigo'
        ? 'text-st-indigo-glow'
        : tone === 'emerald'
          ? 'text-st-emerald-glow'
          : 'text-st-hi';

  return (
    <div className="bg-st-card border border-st-border rounded-lg p-3.5 sm:p-4">
      <p className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim mb-1.5">
        {label}
      </p>
      <p className={cn('font-mono text-2xl font-medium leading-none', valueColor)}>{value}</p>
      {sub && <p className="text-[10.5px] font-mono text-st-dim mt-1">{sub}</p>}
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

interface HeatmapProps {
  days: string[];
  shiftsByDay: Map<string, Shift[]>;
  today: string;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

function Heatmap({ days, shiftsByDay, today, selectedDate, onSelect }: HeatmapProps) {
  const maxCount = useMemo(
    () => Math.max(1, ...days.map((d) => shiftsByDay.get(d)?.length ?? 0)),
    [days, shiftsByDay],
  );

  return (
    <div className="bg-st-card border border-st-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim">
            30 derniers jours
          </p>
          <p className="text-[13.5px] text-st-hi mt-0.5">
            Carte d&apos;activité{' '}
            <em className="font-display italic text-st-sec text-[13px]">
              · clic pour filtrer un jour
            </em>
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-st-dim">
          <span>moins</span>
          {[1, 2, 3, 4].map((l) => (
            <span
              key={l}
              className="w-2.5 h-2.5 rounded-[2px]"
              style={{
                background:
                  l === 1
                    ? 'rgba(99,102,241,.15)'
                    : l === 2
                      ? 'rgba(99,102,241,.30)'
                      : l === 3
                        ? 'rgba(99,102,241,.55)'
                        : '#6366F1',
              }}
            />
          ))}
          <span>plus</span>
        </div>
      </div>

      {/* Grid — 30 days */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}
        role="grid"
        aria-label="Carte d'activité des 30 derniers jours"
      >
        {days.map((date) => {
          const shifts = shiftsByDay.get(date) ?? [];
          const count = shifts.length;
          const hasClosed = shifts.some((s) => s.status === 'CLOSED');
          const isToday = date === today;
          const isSelected = selectedDate === date;
          const level =
            count === 0
              ? 0
              : count >= maxCount * 0.75
                ? 4
                : count >= maxCount * 0.5
                  ? 3
                  : count >= maxCount * 0.25
                    ? 2
                    : 1;

          const dayNum = parseInt(date.split('-')[2] ?? '0', 10);

          return (
            <button
              key={date}
              disabled={count === 0}
              onClick={() => count > 0 && onSelect(date)}
              className={cn(
                'aspect-square rounded-[3px] flex items-center justify-center',
                'text-[9px] font-mono relative transition-all duration-100',
                count === 0 && 'cursor-default opacity-40',
                count > 0 && 'cursor-pointer hover:scale-110 hover:z-10',
              )}
              style={{
                background:
                  level === 0
                    ? '#141A2B'
                    : level === 1
                      ? 'rgba(99,102,241,.15)'
                      : level === 2
                        ? 'rgba(99,102,241,.30)'
                        : level === 3
                          ? 'rgba(99,102,241,.55)'
                          : '#6366F1',
                border: isSelected
                  ? '2px solid #818CF8'
                  : isToday
                    ? '1px solid #D4A574'
                    : level === 0
                      ? '1px solid #1B2236'
                      : '1px solid transparent',
                color: level >= 3 ? 'white' : '#5A6485',
                outline: 'none',
              }}
              aria-label={`${date}: ${count} shift${count !== 1 ? 's' : ''}`}
              role="gridcell"
            >
              {dayNum}
              {/* Gold dot for days with CLOSED shifts */}
              {hasClosed && (
                <span
                  className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full"
                  style={{ background: '#D4A574', boxShadow: '0 0 4px #D4A574' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab pill ──────────────────────────────────────────────────────────────────

interface TabPillProps {
  active: boolean;
  dotColor?: string;
  onClick: () => void;
  children: React.ReactNode;
}

function TabPill({ active, dotColor, onClick, children }: TabPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
        active
          ? 'bg-st-raised text-st-hi border border-st-stroke'
          : 'text-st-sec hover:text-st-hi border border-transparent',
      )}
    >
      {dotColor && (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
      )}
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-pill text-[10px] font-mono font-medium ml-0.5"
      style={{ background: '#1B2236', color: '#8892B0' }}
    >
      {n}
    </span>
  );
}

// ── Date group ────────────────────────────────────────────────────────────────

interface DateGroupProps {
  date: string;
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
}

function DateGroup({ date, shifts, onShiftClick }: DateGroupProps) {
  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ background: '#0F1422', border: '1px solid #1B2236' }}
    >
      {/* Date header */}
      <header
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: '#1B2236' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-st-hi capitalize font-medium">{formatDateGroup(date)}</p>
          <p className="text-[10.5px] font-mono text-st-dim">{date}</p>
        </div>
        <span className="text-[11px] font-mono text-st-sec shrink-0">
          {shifts.length} shift{shifts.length > 1 ? 's' : ''}
        </span>
      </header>

      {/* Shift rows */}
      {shifts.map((shift) => (
        <ShiftRow key={shift.id} shift={shift} onClick={() => onShiftClick(shift)} />
      ))}
    </div>
  );
}

// ── Shift row ─────────────────────────────────────────────────────────────────

interface ShiftRowProps {
  shift: Shift;
  onClick: () => void;
}

function ShiftRow({ shift, onClick }: ShiftRowProps) {
  const cfg = SHIFT_TYPE_CFG[shift.shiftType];
  const isClosed = shift.status === 'CLOSED';

  return (
    <button
      className={cn(
        'w-full text-left transition-colors duration-100',
        'border-b last:border-0',
        isClosed ? 'hover:bg-[#1B2236]' : 'hover:bg-[#141A2B] opacity-60',
      )}
      style={{ borderColor: '#141A2B' }}
      onClick={onClick}
      aria-label={`${cfg.label} ${formatTime(shift.startTime)} → ${formatTime(shift.endTime)}`}
    >
      {/* Desktop layout */}
      <div
        className="hidden sm:grid items-center px-4 py-3"
        style={{
          gridTemplateColumns: '24px 1fr 130px 100px 110px 130px 18px',
          gap: '14px',
        }}
      >
        {/* Checkbox placeholder — future bulk selection */}
        <span
          className="w-[18px] h-[18px] rounded-[4px] border border-st-stroke shrink-0"
          style={{ borderColor: isClosed ? '#3A4366' : '#1B2236' }}
        />

        {/* Type + time */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base" style={{ color: 'var(--type-c)' }}>
            {cfg?.icon ?? '●'}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-st-hi">{cfg?.label}</p>
            <p className="text-[10.5px] font-mono text-st-dim">
              {formatTime(shift.startTime)} → {formatTime(shift.endTime)}
            </p>
          </div>
        </div>

        {/* Status */}
        <ShiftStatusBadge status={shift.status} size="sm" />

        {/* Team */}
        <span className="flex items-center gap-1.5 text-[12px] text-st-sec">
          <Users size={12} className="text-st-dim" />
          <span className="font-mono text-st-hi">{shift.assignments.length}</span>
          <span className="text-st-dim">emp.</span>
        </span>

        {/* Distribution status */}
        <span className="text-[11px]">
          {isClosed ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill font-medium"
              style={{
                background: 'rgba(212,165,116,.10)',
                border: '1px solid rgba(212,165,116,.3)',
                color: '#D4A574',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#D4A574]" />À distribuer
            </span>
          ) : (
            <span className="text-st-dim italic text-[11px]">—</span>
          )}
        </span>

        {/* CTA */}
        {isClosed ? (
          <span
            className="flex items-center gap-1 text-[11px] font-medium text-st-indigo-glow px-2.5 py-1 rounded-md whitespace-nowrap"
            style={{ background: 'rgba(99,102,241,.1)' }}
          >
            Voir <ArrowRight size={11} />
          </span>
        ) : (
          <span className="text-st-dim italic text-[11px]">—</span>
        )}

        <ChevronRight size={14} className="text-st-dim justify-self-center" />
      </div>

      {/* Mobile layout */}
      <div className="sm:hidden flex items-center gap-3 px-3 py-3">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-base"
          style={{
            background: isClosed ? 'rgba(212,165,116,.1)' : 'rgba(90,100,133,.1)',
          }}
        >
          {cfg?.icon ?? '●'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-st-hi font-medium">{cfg?.label}</span>
            <ShiftStatusBadge status={shift.status} size="sm" />
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-st-sec">
            <span className="font-mono">
              {formatTime(shift.startTime)} → {formatTime(shift.endTime)}
            </span>
            <span className="text-st-dim">·</span>
            <span className="font-mono">{shift.assignments.length} emp.</span>
          </div>
        </div>
        <ChevronRight size={14} className="text-st-dim shrink-0" />
      </div>
    </button>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  statusFilter: StatusFilter;
  selectedDate: string | null;
}

function EmptyState({ statusFilter, selectedDate }: EmptyStateProps) {
  const messages: Record<string, string> = {
    CLOSED: "Tous les shifts récents ont été distribués ou il n'y a aucun shift clôturé.",
    IN_PROGRESS: 'Aucun shift en cours dans cette période.',
    PLANNED: 'Aucun shift planifié dans cette période.',
    all: 'Aucun shift dans cette période.',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(90,100,133,.1)' }}
      >
        <span className="text-xl text-st-dim">◉</span>
      </div>
      <p className="text-[14px] font-medium text-st-hi">Aucun résultat</p>
      <p className="text-[12.5px] text-st-sec max-w-xs">
        {selectedDate
          ? `Aucun shift le ${formatDateGroup(selectedDate)}.`
          : (messages[statusFilter] ?? messages.all)}
      </p>
    </div>
  );
}
