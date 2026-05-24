'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ServiceTimeline } from '../../../../components/dashboard/shifts/service-timeline';
import { ShiftStatusBadge } from '../../../../components/dashboard/shifts/shift-status-badge';
import { SHIFT_TYPE_CFG } from '../../../../components/dashboard/shifts/shift-type-chip';
import {
  CreateShiftDialog,
  type ShiftFormValues,
} from '../../../../components/dashboard/shifts/create-shift-dialog';
import { useShifts, useCreateShift } from '../../../../hooks/use-shifts';
import {
  SHIFT_TYPES,
  SHIFT_STATUSES,
  type Shift,
  type ShiftStatus,
  type ShiftType,
  type CreateShiftPayload,
} from '../../../../types/shift';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Safely extract the "YYYY-MM-DD" portion from any ISO string.
 * The API returns date fields as full UTC ISO timestamps ("2026-05-21T00:00:00.000Z").
 * Parsing those with parseISO() converts to local time, shifting the date by ±1 day
 * in non-UTC timezones. Extracting the date-only prefix avoids this entirely.
 */
function dateOnlyStr(raw: string): string {
  return raw.split('T')[0] ?? raw;
}

function formatDateGroup(raw: string): string {
  try {
    // Use date-only string so parseISO treats it as LOCAL midnight, not UTC midnight.
    const d = parseISO(dateOnlyStr(raw));
    if (!isValid(d)) return '—';
    const label = format(d, 'EEEE d MMMM', { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
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

function isToday(raw: string): boolean {
  // Compare date strings directly — avoids timezone conversion issues.
  // dateOnlyStr("2026-05-21T00:00:00.000Z") → "2026-05-21"
  // getLocalToday() → "2026-05-21" in any timezone
  try {
    const now = new Date();
    const todayStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    return dateOnlyStr(raw) === todayStr;
  } catch {
    return false;
  }
}

// ── Status / type config ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<ShiftStatus, string> = {
  PLANNED: 'Planifié',
  IN_PROGRESS: 'En cours',
  CLOSED: 'Clôturé',
  CANCELLED: 'Annulé',
};

const STATUS_COLOR: Record<ShiftStatus, string> = {
  PLANNED: '#8892B0',
  IN_PROGRESS: '#818CF8',
  CLOSED: '#34D399',
  CANCELLED: '#5A6485',
};

// ── Dropdown select style ─────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: '#0F1422',
  border: '1px solid #252D45',
  borderRadius: 8,
  padding: '7px 30px 7px 11px',
  color: '#C5CCE0',
  fontFamily: 'var(--st-font-ui)',
  fontSize: 12.5,
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
};

// ── Shift row card ─────────────────────────────────────────────────────────────

interface ShiftCardProps {
  shift: Shift;
  onClick: (id: string) => void;
}

function ShiftCard({ shift, onClick }: ShiftCardProps) {
  const cfg = SHIFT_TYPE_CFG[shift.shiftType];
  const isLive = shift.status === 'IN_PROGRESS';
  const isClosed = shift.status === 'CLOSED';

  return (
    <button
      type="button"
      onClick={() => onClick(shift.id)}
      className={cfg.cssClass}
      style={{
        width: '100%',
        background: '#0F1422',
        border: `1px solid ${isLive ? 'color-mix(in srgb, var(--type-c) 40%, transparent)' : '#1B2236'}`,
        borderLeft: '3px solid var(--type-c)',
        borderRadius: 10,
        padding: '12px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        transition: 'all .14s ease',
        boxShadow: isLive
          ? '0 4px 16px -6px color-mix(in srgb, var(--type-c) 25%, transparent)'
          : 'none',
        opacity: isClosed ? 0.72 : 1,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = '#141A2B';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = '#0F1422';
      }}
    >
      {/* Type icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: 'var(--type-g)',
          border: '1px solid color-mix(in srgb, var(--type-c) 22%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 17,
          flexShrink: 0,
        }}
      >
        {cfg.icon}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span
            style={{
              fontSize: 13.5,
              color: '#F4F6FB',
              fontFamily: 'var(--st-font-ui)',
              fontWeight: 500,
            }}
          >
            {cfg.label}
          </span>
          {isLive && (
            <span
              className="shifts-pulse"
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--type-c)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          )}
          {isClosed && (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#34D399"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--st-font-mono)',
              fontSize: 11.5,
              color: '#8892B0',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
          </span>
          <span
            style={{
              width: 2,
              height: 2,
              borderRadius: '50%',
              background: '#3A4366',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 11, color: '#5A6485', fontFamily: 'var(--st-font-ui)' }}>
            {shift.assignments.length} membre{shift.assignments.length !== 1 ? 's' : ''}
          </span>
          {shift.notes && (
            <>
              <span
                style={{
                  width: 2,
                  height: 2,
                  borderRadius: '50%',
                  background: '#3A4366',
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: '#5A6485',
                  fontFamily: 'var(--st-font-ui)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 180,
                }}
              >
                {shift.notes}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status */}
      <ShiftStatusBadge status={shift.status} size="sm" />

      {/* Chevron */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3A4366"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<ShiftStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ShiftType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data: allShifts = [], isLoading, isError } = useShifts({});
  const createMutation = useCreateShift();

  // Filtered shifts
  const shifts = useMemo<Shift[]>(() => {
    let result = allShifts;
    if (statusFilter !== 'all') result = result.filter((s) => s.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter((s) => s.shiftType === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.notes?.toLowerCase().includes(q) ||
          SHIFT_TYPE_CFG[s.shiftType].label.toLowerCase().includes(q) ||
          STATUS_LABEL[s.status].toLowerCase().includes(q) ||
          formatDateGroup(s.date).toLowerCase().includes(q),
      );
    }
    return result;
  }, [allShifts, statusFilter, typeFilter, searchQuery]);

  // Inline stats
  const stats = useMemo(
    () => ({
      total: allShifts.length,
      inProgress: allShifts.filter((s) => s.status === 'IN_PROGRESS').length,
      planned: allShifts.filter((s) => s.status === 'PLANNED').length,
    }),
    [allShifts],
  );

  // Today's shifts for the service timeline
  const todayShifts = useMemo(() => allShifts.filter((s) => isToday(s.date)), [allShifts]);

  // Group visible shifts by date (newest first)
  const groupedShifts = useMemo(() => {
    const groups = new Map<string, Shift[]>();
    for (const s of shifts) {
      // ROB-M6: guard against missing/malformed date field — s.date may lack a 'T' separator
      const key = s.date ? (s.date.split('T')[0] ?? s.date) : 'unknown';
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [shifts]);

  const handleNavigate = useCallback(
    (id: string) => router.push(`/dashboard/shifts/${id}`),
    [router],
  );

  // QUAL-C3: wrapped in useCallback so ShiftCard children don't re-render on parent re-renders
  const handleFormSubmit = useCallback(
    (data: ShiftFormValues) => {
      // Send wall-clock strings directly so the API stores them as local restaurant time.
      // Do NOT use new Date(...).toISOString() here — that converts to UTC and corrupts
      // the displayed time for restaurants in non-UTC timezones (ROB-C3 / ARCH-H3).
      const payload: CreateShiftPayload = {
        date: data.date,
        shiftType: data.shiftType,
        startTime: `${data.date}T${data.startTime}:00`,
        endTime: `${data.date}T${data.endTime}:00`,
        notes: data.notes || undefined,
      };
      createMutation.mutate(payload, { onSuccess: () => setFormOpen(false) });
    },
    [createMutation],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: '#0A0E1A',
      }}
    >
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px 40px' }}>
        {/* ── Title row ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
            marginBottom: 6,
          }}
        >
          <div>
            <h1
              className="font-display page-title-shifts"
              style={{
                fontSize: 52,
                color: '#F4F6FB',
                margin: 0,
                lineHeight: 1.0,
                letterSpacing: '-0.01em',
              }}
            >
              Services{' '}
              <em
                style={{
                  fontStyle: 'italic',
                  color: '#5A6485',
                  fontFamily: 'var(--st-font-display)',
                }}
              >
                &amp; clôtures.
              </em>
            </h1>
            {/* Inline stats */}
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: '#8892B0',
                fontFamily: 'var(--st-font-ui)',
              }}
            >
              <span style={{ color: '#C5CCE0', fontWeight: 500 }}>{stats.total}</span> shift
              {stats.total !== 1 ? 's' : ''} au total
              {stats.inProgress > 0 && (
                <>
                  {' '}
                  · <span style={{ color: '#818CF8' }}>{stats.inProgress} en cours</span>
                </>
              )}
              {stats.planned > 0 && (
                <>
                  {' '}
                  · <span>{stats.planned} à venir</span>
                </>
              )}
            </p>
          </div>

          {/* Create button */}
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            style={{
              background: '#6366F1',
              border: '1px solid transparent',
              borderRadius: 12,
              padding: '10px 22px',
              color: 'white',
              fontSize: 13.5,
              fontFamily: 'var(--st-font-ui)',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              marginTop: 6,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 4px 14px -4px rgba(99,102,241,.4)',
              transition: 'all .15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#4F46E5';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#6366F1';
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            + Créer un shift
          </button>
        </div>

        {/* ── Service Timeline ──────────────────────────────────────────────── */}
        <div style={{ marginTop: 28 }}>
          <ServiceTimeline shifts={todayShifts} onShiftClick={handleNavigate} />
        </div>

        {/* ── Filters row ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          {/* Status dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ShiftStatus | 'all')}
              style={selectStyle}
              aria-label="Filtrer par statut"
            >
              <option value="all">Tous les statuts</option>
              {SHIFT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5A6485"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                position: 'absolute',
                right: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>

          {/* Type dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ShiftType | 'all')}
              style={selectStyle}
              aria-label="Filtrer par type"
            >
              <option value="all">Tous les types</option>
              {SHIFT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SHIFT_TYPE_CFG[t].label}
                </option>
              ))}
            </select>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5A6485"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                position: 'absolute',
                right: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5A6485"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher dans les notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                ...selectStyle,
                padding: '7px 11px 7px 30px',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Results count */}
          <span
            style={{
              fontFamily: 'var(--st-font-mono)',
              fontSize: 11,
              color: '#5A6485',
              marginLeft: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {shifts.length}/{allShifts.length} résultat{shifts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Shift list ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ fontSize: 13, color: '#5A6485', fontFamily: 'var(--st-font-ui)' }}>
              Chargement des shifts…
            </p>
          </div>
        ) : isError ? (
          <div
            style={{
              padding: '20px 24px',
              background: 'rgba(239,68,68,.06)',
              border: '1px solid rgba(239,68,68,.20)',
              borderRadius: 12,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 13, color: '#EF4444', fontFamily: 'var(--st-font-ui)' }}>
              Erreur lors du chargement des shifts.
            </p>
          </div>
        ) : groupedShifts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 24px',
              background: '#0F1422',
              border: '1px dashed #252D45',
              borderRadius: 14,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 14 }}>◑</div>
            <p
              style={{
                fontSize: 15,
                color: '#F4F6FB',
                fontFamily: 'var(--st-font-ui)',
                marginBottom: 6,
              }}
            >
              Aucun shift trouvé
            </p>
            <p
              style={{
                fontSize: 12.5,
                color: '#5A6485',
                fontFamily: 'var(--st-font-ui)',
                marginBottom: 20,
              }}
            >
              {statusFilter !== 'all' || typeFilter !== 'all' || searchQuery
                ? 'Essayez un autre filtre.'
                : 'Créez votre premier shift pour démarrer.'}
            </p>
            {statusFilter === 'all' && typeFilter === 'all' && !searchQuery && (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                style={{
                  background: '#6366F1',
                  border: '1px solid transparent',
                  borderRadius: 10,
                  padding: '8px 18px',
                  color: 'white',
                  fontSize: 12,
                  fontFamily: 'var(--st-font-ui)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Créer un shift
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {groupedShifts.map(([dateKey, dayShifts]) => {
              const today = isToday(dayShifts[0]!.date);
              const dateISO = dayShifts[0]!.date;
              return (
                <div key={dateKey}>
                  {/* Date group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    {today && (
                      <span
                        className="shifts-pulse"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#818CF8',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontFamily: 'var(--st-font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.16em',
                        fontSize: 10.5,
                        color: today ? '#818CF8' : '#5A6485',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {/* Use date-only string to avoid UTC→local shift */}
                      {today ? "Aujourd'hui" : 'Date'} —{' '}
                      {format(parseISO(dateOnlyStr(dateISO)), 'EEE d MMM', {
                        locale: fr,
                      }).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, height: 1, background: '#1B2236' }} />
                    <span
                      style={{
                        fontFamily: 'var(--st-font-mono)',
                        fontSize: 10,
                        color: '#3A4366',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Shift cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {dayShifts.map((shift) => (
                      <ShiftCard key={shift.id} shift={shift} onClick={handleNavigate} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create shift dialog */}
      <CreateShiftDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        loading={createMutation.isPending}
      />
    </div>
  );
}
