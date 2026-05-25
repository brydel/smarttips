'use client';

import { useState, useMemo } from 'react';
import type { RoleAggregate } from '../types/distribution.types';
import { arcPath, computeDonutSlices } from '../utils/distribution-calculations';
import { cn } from '../../../lib/cn';

interface DistributionDonutChartProps {
  aggregates: RoleAggregate[];
  poolTotal: number;
  /** Externally controlled hover (role id), for sync with the table rows */
  hoveredRole?: string | null;
  onHoverRole?: (role: string | null) => void;
}

const SIZE = 220;
const RADIUS = SIZE / 2;
const INNER_RADIUS = RADIUS * 0.62;
const CX = RADIUS;
const CY = RADIUS;

export function DistributionDonutChart({
  aggregates,
  poolTotal,
  hoveredRole,
  onHoverRole,
}: DistributionDonutChartProps) {
  const [localHover, setLocalHover] = useState<string | null>(null);
  const activeRole = hoveredRole !== undefined ? hoveredRole : localHover;

  const handleHover = (role: string | null) => {
    setLocalHover(role);
    onHoverRole?.(role);
  };

  const slices = useMemo(() => computeDonutSlices(aggregates), [aggregates]);
  const hoveredSlice = slices.find((s) => s.role === activeRole);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Donut SVG */}
      <div className="relative" style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="overflow-visible"
          style={{ maxWidth: '100%', height: 'auto' }}
        >
          {slices.map((slice) => {
            const dim = !!activeRole && slice.role !== activeRole;
            const d = arcPath(CX, CY, INNER_RADIUS, RADIUS, slice.startAngle, slice.endAngle);
            return (
              <path
                key={slice.role}
                d={d}
                fill={slice.color}
                style={{
                  transformOrigin: 'center',
                  transition: 'transform 0.2s cubic-bezier(.2,.7,.3,1), opacity 0.2s ease',
                  transform: activeRole === slice.role ? 'scale(1.04)' : 'scale(1)',
                  opacity: dim ? 0.25 : 1,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => handleHover(slice.role)}
                onMouseLeave={() => handleHover(null)}
                role="button"
                aria-label={`${slice.label}: $${slice.amount.toFixed(2)}`}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4"
          aria-live="polite"
          aria-atomic="true"
        >
          {hoveredSlice ? (
            <>
              <span
                className="text-[9.5px] font-mono uppercase tracking-[0.14em] mb-1"
                style={{ color: hoveredSlice.color }}
              >
                {hoveredSlice.label}
              </span>
              <span className="font-mono font-medium text-xl text-st-hi leading-none">
                ${hoveredSlice.amount.toFixed(2)}
              </span>
              <span className="text-[10.5px] font-mono text-st-dim mt-1">
                {(hoveredSlice.share * 100).toFixed(1)}% du pool
              </span>
            </>
          ) : (
            <>
              <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim mb-1">
                Pool distribué
              </span>
              <span className="font-mono font-medium text-2xl text-st-gold-glow leading-none">
                ${poolTotal.toFixed(2)}
              </span>
              <span className="text-[10.5px] text-st-dim mt-1">Survolez pour détailler</span>
            </>
          )}
        </div>
      </div>

      {/* Legend grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
        {aggregates.map((agg) => (
          <button
            key={agg.role}
            className={cn(
              'flex items-center gap-2 text-left bg-transparent border-0 p-1 rounded-sm cursor-pointer transition-opacity',
              activeRole && activeRole !== agg.role ? 'opacity-40' : 'opacity-100',
            )}
            onMouseEnter={() => handleHover(agg.role)}
            onMouseLeave={() => handleHover(null)}
            aria-label={`${agg.label}: $${agg.amount.toFixed(2)}`}
          >
            <span
              className="w-2.5 h-2.5 rounded-[2px] shrink-0"
              style={{ background: agg.color }}
            />
            <span className="flex-1 text-[12px] text-st-pri truncate">
              {agg.label} <span className="text-st-dim">· {agg.headcount}</span>
            </span>
            <span className="font-mono text-[11px] text-st-hi shrink-0">
              ${agg.amount.toFixed(0)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
