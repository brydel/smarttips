'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  isValid,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { SHIFT_TYPE_CFG } from './shift-type-chip';
import type { Shift } from '../../../types/shift';

// ── Day cell data ──────────────────────────────────────────────────────────────

interface DayData {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  shifts: Shift[];
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ShiftCalendarProps {
  shifts: Shift[];
  selectedDate: string; // YYYY-MM-DD or ''
  onSelectDate: (date: string) => void; // '' to clear
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ShiftCalendar({ shifts, selectedDate, onSelectDate }: ShiftCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      if (isValid(d)) return d;
    }
    return new Date();
  });

  const monthLabel = format(viewMonth, 'MMMM yyyy', { locale: fr });
  const monthTitleCase = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Build grid: 6 weeks × 7 days
  const grid = useMemo<DayData[][]>(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    // Index shifts by ISO date key
    const shiftsByDay = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = s.date.split('T')[0]!;
      const arr = shiftsByDay.get(key) ?? [];
      arr.push(s);
      shiftsByDay.set(key, arr);
    }

    const rows: DayData[][] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      const row: DayData[] = [];
      for (let d = 0; d < 7; d++) {
        const key = format(cursor, 'yyyy-MM-dd');
        const sel = selectedDate === key;
        row.push({
          date: cursor,
          inMonth: isSameMonth(cursor, viewMonth),
          isToday: isToday(cursor),
          isSelected: sel,
          shifts: shiftsByDay.get(key) ?? [],
        });
        cursor = addDays(cursor, 1);
      }
      rows.push(row);
    }
    return rows;
  }, [viewMonth, shifts, selectedDate]);

  const handleDayClick = (day: DayData) => {
    const key = format(day.date, 'yyyy-MM-dd');
    onSelectDate(key === selectedDate ? '' : key);
  };

  const DAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <div
      style={{
        background: '#0F1422',
        border: '1px solid #1B2236',
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 18,
        userSelect: 'none',
      }}
    >
      {/* Month navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          style={{
            background: 'transparent',
            border: '1px solid #252D45',
            borderRadius: 8,
            width: 28,
            height: 28,
            color: '#8892B0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#141A2B';
            (e.currentTarget as HTMLButtonElement).style.color = '#F4F6FB';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#8892B0';
          }}
          aria-label="Mois précédent"
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
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3
            className="font-display"
            style={{ fontSize: 16, color: '#F4F6FB', margin: 0, lineHeight: 1 }}
          >
            {monthTitleCase}
          </h3>
          {/* Today shortcut */}
          {!isSameMonth(viewMonth, new Date()) && (
            <button
              type="button"
              onClick={() => setViewMonth(new Date())}
              style={{
                background: 'rgba(99,102,241,.12)',
                border: '1px solid rgba(99,102,241,.25)',
                borderRadius: 6,
                padding: '2px 8px',
                color: '#818CF8',
                fontSize: 10.5,
                fontFamily: 'var(--st-font-mono)',
                cursor: 'pointer',
                letterSpacing: '0.06em',
              }}
            >
              AUJOURD&apos;HUI
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          style={{
            background: 'transparent',
            border: '1px solid #252D45',
            borderRadius: 8,
            width: 28,
            height: 28,
            color: '#8892B0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#141A2B';
            (e.currentTarget as HTMLButtonElement).style.color = '#F4F6FB';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#8892B0';
          }}
          aria-label="Mois suivant"
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
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAY_HEADERS.map((h, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: 9.5,
              fontFamily: 'var(--st-font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: i >= 5 ? '#3A4366' : '#5A6485',
              paddingBottom: 6,
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {row.map((day, di) => {
              const hasSomeShift = day.shifts.length > 0;
              // Up to 3 shift type dots
              const dotShifts = day.shifts.slice(0, 3);

              return (
                <button
                  key={di}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  style={{
                    position: 'relative',
                    height: 34,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    borderRadius: 8,
                    background: day.isSelected
                      ? '#6366F1'
                      : day.isToday
                        ? 'rgba(99,102,241,.12)'
                        : 'transparent',
                    border:
                      day.isToday && !day.isSelected
                        ? '1px solid rgba(99,102,241,.3)'
                        : '1px solid transparent',
                    color: day.isSelected
                      ? 'white'
                      : day.isToday
                        ? '#818CF8'
                        : day.inMonth
                          ? '#C5CCE0'
                          : '#2D3654',
                    cursor: 'pointer',
                    transition: 'all .12s ease',
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 12.5,
                    fontWeight: day.isToday || day.isSelected ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!day.isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#141A2B';
                      (e.currentTarget as HTMLButtonElement).style.color = '#F4F6FB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!day.isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.background = day.isToday
                        ? 'rgba(99,102,241,.12)'
                        : 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = day.isToday
                        ? '#818CF8'
                        : day.inMonth
                          ? '#C5CCE0'
                          : '#2D3654';
                    }
                  }}
                  aria-label={`${format(day.date, 'd MMMM yyyy', { locale: fr })} — ${day.shifts.length} shift${day.shifts.length !== 1 ? 's' : ''}`}
                  aria-pressed={day.isSelected}
                >
                  {/* Date number */}
                  <span style={{ lineHeight: 1 }}>{format(day.date, 'd')}</span>

                  {/* Shift dots */}
                  {hasSomeShift && (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      {dotShifts.map((s, si) => {
                        const cfg = SHIFT_TYPE_CFG[s.shiftType];
                        return (
                          <div
                            key={si}
                            className={day.isSelected ? '' : cfg.cssClass}
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              background: day.isSelected ? 'rgba(255,255,255,.7)' : 'var(--type-c)',
                              flexShrink: 0,
                            }}
                          />
                        );
                      })}
                      {day.shifts.length > 3 && (
                        <span
                          style={{
                            fontSize: 8,
                            color: day.isSelected ? 'rgba(255,255,255,.7)' : '#5A6485',
                            fontFamily: 'var(--st-font-mono)',
                            lineHeight: 1,
                          }}
                        >
                          +{day.shifts.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      {selectedDate && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid #1B2236',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 11, color: '#8892B0', fontFamily: 'var(--st-font-ui)' }}>
            {format(new Date(selectedDate), 'EEEE d MMMM yyyy', { locale: fr }).replace(/^./, (c) =>
              c.toUpperCase(),
            )}
          </span>
          <button
            type="button"
            onClick={() => onSelectDate('')}
            style={{
              background: 'transparent',
              border: 0,
              color: '#5A6485',
              fontSize: 10.5,
              fontFamily: 'var(--st-font-mono)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Effacer
          </button>
        </div>
      )}
    </div>
  );
}
