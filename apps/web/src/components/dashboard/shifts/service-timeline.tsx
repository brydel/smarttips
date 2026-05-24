'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SHIFT_TYPE_CFG } from './shift-type-chip';
import type { Shift } from '../../../types/shift';

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeToHour(iso: string): number {
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return 0;
    return d.getHours() + d.getMinutes() / 60;
  } catch {
    return 0;
  }
}

function nowHour(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

// ── Timeline constants — module-level (QUAL-M9) ────────────────────────────────
// 6h → 30h window: 24h span starting at 6am to handle overnight shifts
const START_H = 6;
const END_H = 30;
const SPAN = END_H - START_H;

// ── Lane assignment ────────────────────────────────────────────────────────────
// Detects overlapping shifts and assigns them to vertical lanes so blocks
// never sit on top of each other, making text always readable.

interface ShiftBlock {
  id: string;
  sh: number; // start hour (may be > 24 for overnight)
  eh: number; // end hour
}

/**
 * Returns a map from shift.id → lane index (0-based).
 * Shifts are sorted by start time; each gets the lowest free lane.
 * A 3-minute grace window (0.05h) avoids false overlaps on back-to-back shifts.
 */
function assignLanes(blocks: ShiftBlock[]): Map<string, number> {
  const result = new Map<string, number>();
  const laneEnds: number[] = []; // tracks when each lane becomes free
  const sorted = [...blocks].sort((a, b) => a.sh - b.sh);

  for (const b of sorted) {
    let lane = laneEnds.findIndex((end) => end <= b.sh + 0.05);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = b.eh;
    result.set(b.id, lane);
  }
  return result;
}

// ── Block geometry per lane count ──────────────────────────────────────────────
// The usable rail height for shift blocks is RAIL_H px.
// We keep a 2px gap between lanes and ensure blocks stay within RAIL_H.

const RAIL_H = 60; // px available for shift blocks (within 64px, 4px for NOW pill)
const LANE_GAP = 3; // px gap between lanes

function laneGeometry(totalLanes: number): { height: number; getTop: (lane: number) => number } {
  const count = Math.min(totalLanes, 3); // cap at 3 lanes; beyond that overlap is intentional
  const height = Math.floor((RAIL_H - LANE_GAP * (count - 1)) / count);
  const getTop = (lane: number) => Math.min(lane, count - 1) * (height + LANE_GAP);
  return { height, getTop };
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ServiceTimelineProps {
  shifts: Shift[];
  onShiftClick?: (id: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ServiceTimeline({ shifts, onShiftClick }: ServiceTimelineProps) {
  const pct = (h: number) => ((h - START_H) / SPAN) * 100;

  // Hour ticks every 2h — no deps (constants are module-level)
  const ticks = useMemo(() => {
    const t: number[] = [];
    for (let h = START_H; h <= END_H; h += 2) t.push(h);
    return t;
  }, []);

  // Live NOW marker — updates every minute (ROB-M7)
  const [currentHour, setCurrentHour] = useState(nowHour);
  useEffect(() => {
    const interval = setInterval(() => setCurrentHour(nowHour()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Compute block positions + lane assignment ──────────────────────────────
  const blocks = useMemo<ShiftBlock[]>(
    () =>
      shifts.map((s) => {
        let sh = timeToHour(s.startTime);
        let eh = timeToHour(s.endTime);
        if (eh <= sh) eh += 24; // overnight (LATE_NIGHT)
        return { id: s.id, sh, eh };
      }),
    [shifts],
  );

  const laneMap = useMemo(() => assignLanes(blocks), [blocks]);
  const totalLanes = useMemo(
    () => Math.max(1, ...Array.from(laneMap.values()).map((l) => l + 1)),
    [laneMap],
  );
  const { height: blockH, getTop } = laneGeometry(totalLanes);

  const inProgress = shifts.find((s) => s.status === 'IN_PROGRESS');
  const todayLabel = format(new Date(), 'EEEE d MMMM', { locale: fr });
  const todayTitleCase = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  return (
    // RESP-H4: horizontal scroll on narrow viewports
    <div className="service-timeline-wrapper">
      <div
        style={{
          padding: '20px 22px',
          background: '#0F1422',
          border: '1px solid #1B2236',
          borderRadius: 14,
          marginBottom: 18,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div>
            <span
              style={{
                fontFamily: 'var(--st-font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                fontSize: 10.5,
                color: '#8892B0',
              }}
            >
              {todayTitleCase}
            </span>
            <h3
              className="font-display"
              style={{ fontSize: 22, margin: '4px 0 0', color: '#F4F6FB', lineHeight: 1 }}
            >
              Rythme de service{' '}
              <em
                style={{
                  fontFamily: 'var(--st-font-display)',
                  fontStyle: 'italic',
                  color: '#5A6485',
                }}
              >
                en direct.
              </em>
            </h3>
          </div>

          {inProgress && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 999,
                background: 'rgba(99,102,241,.10)',
                border: '1px solid rgba(99,102,241,.25)',
              }}
            >
              <span
                className="shifts-pulse"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#818CF8',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 11.5, color: '#818CF8' }}>
                Service en cours · {SHIFT_TYPE_CFG[inProgress.shiftType].label.toLowerCase()}
              </span>
            </div>
          )}
        </div>

        {/* Timeline rail — height grows slightly when there are multiple lanes */}
        <div
          style={{
            position: 'relative',
            height: Math.max(88, blockH * totalLanes + LANE_GAP * (totalLanes - 1) + 28),
          }}
        >
          {/* Grid lines */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 22,
              display: 'flex',
            }}
          >
            {ticks.map((h, i) => (
              <div
                key={h}
                style={{ flex: 1, borderLeft: i === 0 ? 'none' : '1px dashed #1B2236' }}
              />
            ))}
          </div>

          {/* Shift blocks */}
          {shifts.map((shift) => {
            const b = blocks.find((x) => x.id === shift.id)!;
            const lane = laneMap.get(shift.id) ?? 0;
            const left = pct(b.sh);
            const widthPct = Math.max(pct(b.eh) - pct(b.sh), 1.5); // min 1.5% so border is visible
            const cfg = SHIFT_TYPE_CFG[shift.shiftType];
            const isLive = shift.status === 'IN_PROGRESS';
            const isClosed = shift.status === 'CLOSED';

            // ── Text visibility based on block width ──────────────────────────
            // Each timeline hour ≈ 4.2% of width (100% / 24h)
            // < 6%  → only left border + icon (≈ < 1.5h)
            // < 11% → icon + label, no time (≈ < 2.5h)
            // ≥ 11% → full text
            const showLabel = widthPct >= 6;
            const showTime = widthPct >= 11;

            const blockTop = getTop(lane);

            return (
              <button
                key={shift.id}
                onClick={() => onShiftClick?.(shift.id)}
                className={cfg.cssClass}
                style={{
                  position: 'absolute',
                  top: blockTop,
                  height: blockH,
                  left: `${left}%`,
                  width: `${widthPct}%`,
                  borderRadius: 5,
                  padding: showLabel ? '5px 8px' : '0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  // overflow hidden clips text to the block — prevents bleed onto neighbours
                  overflow: 'hidden',
                  transition: 'transform .15s ease, box-shadow .15s ease',
                  background: isClosed
                    ? 'rgba(0,0,0,0)'
                    : `color-mix(in srgb, var(--type-c) 14%, #0A0E1A)`,
                  border: '1px solid transparent',
                  borderLeftWidth: 3,
                  borderLeftColor: 'var(--type-c)',
                  opacity: isClosed ? 0.55 : 1,
                  // Live glow
                  boxShadow: isLive
                    ? '0 0 0 1px color-mix(in srgb, var(--type-c) 35%, transparent), 0 6px 18px -6px color-mix(in srgb, var(--type-c) 30%, transparent)'
                    : '0 1px 3px rgba(0,0,0,.3)',
                  // Separate adjacent blocks with a tiny right margin
                  marginRight: 1,
                  zIndex: isLive ? 2 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.zIndex = '3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.zIndex = isLive ? '2' : '1';
                }}
                aria-label={`${cfg.label} ${showTime ? `· ${format(parseISO(shift.startTime), 'HH:mm')}–${format(parseISO(shift.endTime), 'HH:mm')}` : ''} · ${shift.status}`}
                title={`${cfg.label} · ${(() => {
                  const s = parseISO(shift.startTime);
                  const e = parseISO(shift.endTime);
                  return `${isValid(s) ? format(s, 'HH:mm') : '—'}–${isValid(e) ? format(e, 'HH:mm') : '—'}`;
                })()} · ${shift.assignments.length}p`}
              >
                {showLabel ? (
                  <>
                    {/* Top row: icon + label + status indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: Math.max(10, blockH * 0.22),
                          color: 'var(--type-c)',
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        {cfg.icon}
                      </span>
                      <span
                        style={{
                          fontSize: Math.max(9, Math.min(11.5, blockH * 0.18)),
                          fontWeight: 600,
                          color: '#F4F6FB',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          // Text shadow ensures readability against any block background
                          textShadow: '0 1px 3px rgba(0,0,0,.7), 0 0 8px rgba(0,0,0,.5)',
                          lineHeight: 1,
                        }}
                      >
                        {cfg.label}
                      </span>
                      {isLive && (
                        <span
                          className="shifts-pulse"
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: 'var(--type-c)',
                            marginLeft: 'auto',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {isClosed && (
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#34D399"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ marginLeft: 'auto', flexShrink: 0 }}
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>

                    {/* Bottom row: time range + pax — only when tall enough */}
                    {showTime && (
                      <div
                        style={{
                          fontSize: Math.max(8.5, Math.min(10, blockH * 0.15)),
                          fontFamily: 'var(--st-font-mono)',
                          color: 'var(--type-c)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          // Frosted micro-backdrop makes time readable over any adjacent block
                          textShadow: '0 1px 4px rgba(0,0,0,.8)',
                          opacity: 0.85,
                          lineHeight: 1,
                        }}
                      >
                        {(() => {
                          const s = parseISO(shift.startTime);
                          const e = parseISO(shift.endTime);
                          return `${isValid(s) ? format(s, 'HH:mm') : '—'}–${isValid(e) ? format(e, 'HH:mm') : '—'}`;
                        })()}
                        {' · '}
                        {shift.assignments.length}p
                      </div>
                    )}
                  </>
                ) : /* Narrow block: only the colored left border is visible — no text to obscure */
                null}
              </button>
            );
          })}

          {/* NOW marker */}
          {currentHour >= START_H && currentHour <= END_H && (
            <div
              style={{
                position: 'absolute',
                top: -6,
                bottom: 18,
                left: `${pct(currentHour)}%`,
                width: 0,
                borderLeft: '2px solid #D4A574',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -10,
                  left: -22,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: '#D4A574',
                  color: '#0A0E1A',
                  fontSize: 9.5,
                  fontWeight: 600,
                  fontFamily: 'var(--st-font-mono)',
                  letterSpacing: '0.06em',
                }}
              >
                NOW
              </div>
            </div>
          )}

          {/* Hour labels */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              height: 18,
            }}
          >
            {ticks.map((h, i) => (
              <div
                key={h}
                style={{
                  flex: 1,
                  fontSize: 10,
                  color: '#5A6485',
                  fontFamily: 'var(--st-font-mono)',
                  textAlign: 'left',
                  paddingLeft: 4,
                  borderLeft: i === 0 ? 'none' : '1px solid transparent',
                }}
              >
                {String(h % 24).padStart(2, '0')}:00
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
