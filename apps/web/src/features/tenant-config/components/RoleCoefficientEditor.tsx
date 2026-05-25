'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Scale } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { RoleCoefficients, RoleName } from '../types/tenant-config.types';
import { ROLE_NAMES, ROLE_META } from '../types/tenant-config.types';

interface RoleCoefficientEditorProps {
  values: RoleCoefficients;
  original: RoleCoefficients;
  onChange: (role: RoleName, value: number) => void;
  readOnly: boolean;
  errors: Partial<Record<RoleName, string>>;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

interface CoefRowProps {
  role: RoleName;
  value: number;
  original: number;
  max: number;
  sum: number;
  onChange: (v: number) => void;
  readOnly: boolean;
  error?: string;
}

function CoefRow({ role, value, original, max, sum, onChange, readOnly, error }: CoefRowProps) {
  const meta = ROLE_META[role];
  const [localStr, setLocalStr] = useState(value.toFixed(4));
  const inputRef = useRef<HTMLInputElement>(null);
  const isDirty = Math.abs(value - original) > 0.00001;
  const widthPct = (value / max) * 100;
  const ghostPct = (original / max) * 100;
  const sharePct = sum > 0 ? (value / sum) * 100 : 0;
  const isHigh = value > 1.5;

  // Keep local string in sync when value changes externally
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalStr(value.toFixed(4));
    }
  }, [value]);

  const commitLocal = useCallback(() => {
    const n = parseFloat(localStr);
    if (isNaN(n)) {
      setLocalStr(value.toFixed(4));
      return;
    }
    onChange(clamp(n, 0.1, 2.0));
  }, [localStr, value, onChange]);

  // Scrub drag on the bar
  const onBarPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly) return;
      if (document.activeElement === inputRef.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startV = value;

      const onMove = (mv: PointerEvent) => {
        const dx = mv.clientX - startX;
        onChange(clamp(+(startV + dx * 0.005).toFixed(4), 0.1, 2.0));
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [readOnly, value, onChange],
  );

  return (
    <div
      className={cn(
        'border-b border-st-border last:border-b-0 transition-colors duration-100',
        'hover:bg-st-raised/40',
      )}
    >
      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[140px_120px_1fr_56px] gap-3.5 items-center px-5 py-3">
        {/* Role label */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[13px] flex-shrink-0"
            style={{
              background: `${meta.color}20`,
              color: meta.color,
            }}
          >
            ●
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] text-st-hi truncate">{meta.label}</p>
            <p className="text-[10px] text-st-dim font-mono">{role}</p>
          </div>
        </div>

        {/* Numeric input */}
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="number"
            step="0.0001"
            min="0.1"
            max="2.0"
            disabled={readOnly}
            value={localStr}
            onChange={(e) => setLocalStr(e.target.value)}
            onBlur={commitLocal}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={cn(
              'w-full bg-st-raised border rounded-sm px-2.5 py-1.5',
              'font-mono tabular-nums text-[13px] text-center outline-none',
              'transition-all duration-150',
              'hover:border-st-muted focus:border-st-indigo focus:ring-1 focus:ring-st-indigo/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isDirty && !readOnly
                ? 'border-st-emerald/50 text-st-emerald-glow'
                : 'border-st-border text-st-hi',
              error && 'border-st-danger',
            )}
            title={readOnly ? undefined : 'Glissez la barre ou tapez pour modifier'}
            aria-label={`Coefficient ${meta.label}`}
          />
          {error && <p className="text-[10px] text-st-danger font-sans">{error}</p>}
        </div>

        {/* Proportional bar */}
        <div
          className={cn(
            'relative h-2 bg-st-stroke rounded-full overflow-hidden',
            !readOnly && 'cursor-ew-resize',
          )}
          onPointerDown={onBarPointerDown}
          title={readOnly ? undefined : 'Glissez pour ajuster'}
        >
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-200"
            style={{
              width: `${widthPct}%`,
              background: `linear-gradient(90deg, ${meta.color}80, ${meta.color})`,
            }}
          />
          {isDirty && Math.abs(widthPct - ghostPct) > 0.5 && (
            <div
              className="absolute top-0 bottom-0"
              style={{
                width: `${ghostPct}%`,
                borderRight: `2px dashed ${meta.color}60`,
              }}
              title={`Avant: ${original.toFixed(4)}`}
            />
          )}
        </div>

        {/* Share % */}
        <span className="font-mono text-[11.5px] text-st-sec text-right tabular-nums">
          {sharePct.toFixed(0)}%
        </span>
      </div>

      {/* Mobile card */}
      <div className="md:hidden px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0"
              style={{ background: `${meta.color}20`, color: meta.color }}
            >
              ●
            </span>
            <div>
              <p className="text-[13px] text-st-hi font-medium">{meta.label}</p>
              <p className="text-[10px] text-st-dim font-mono">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-st-sec font-mono">{sharePct.toFixed(0)}%</span>
            <input
              ref={readOnly ? undefined : inputRef}
              type="number"
              step="0.0001"
              min="0.1"
              max="2.0"
              disabled={readOnly}
              value={localStr}
              onChange={(e) => setLocalStr(e.target.value)}
              onBlur={commitLocal}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={cn(
                'w-[80px] bg-st-raised border rounded-sm px-2 py-1.5',
                'font-mono tabular-nums text-[13px] text-center outline-none',
                'transition-all duration-150',
                'focus:border-st-indigo focus:ring-1 focus:ring-st-indigo/20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isDirty && !readOnly
                  ? 'border-st-emerald/50 text-st-emerald-glow'
                  : 'border-st-border text-st-hi',
              )}
              aria-label={`Coefficient ${meta.label}`}
            />
          </div>
        </div>
        {/* Bar (full width on mobile) */}
        <div className="relative h-2 bg-st-stroke rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-200"
            style={{
              width: `${widthPct}%`,
              background: `linear-gradient(90deg, ${meta.color}80, ${meta.color})`,
            }}
          />
        </div>
        {error && <p className="text-[10.5px] text-st-danger">{error}</p>}
      </div>

      {/* High coefficient warning */}
      {isHigh && !readOnly && (
        <div className="mx-4 md:mx-5 mb-3 px-3 py-2 rounded-sm bg-st-warn/8 border border-st-warn/30 flex gap-2 items-start">
          <span className="text-st-warn text-[11px] mt-0.5">⚠</span>
          <p className="text-[11px] text-st-pri leading-relaxed">
            Attention&nbsp;: un coefficient supérieur à 1,5 peut fortement favoriser ce rôle.
          </p>
        </div>
      )}
    </div>
  );
}

export function RoleCoefficientEditor({
  values,
  original,
  onChange,
  readOnly,
  errors,
}: RoleCoefficientEditorProps) {
  const max = Math.max(2.0, ...Object.values(values));
  const sum = Object.values(values).reduce((s, v) => s + v, 0);

  return (
    <section className="bg-st-card border border-st-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-st-border">
        <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-st-raised flex items-center justify-center">
          <Scale size={14} className="text-st-pri" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="st-eyebrow text-st-sec mb-0.5">Section 2</p>
          <h2 className="font-display text-[20px] text-st-hi leading-tight">
            Coefficients par rôle
          </h2>
        </div>
        <span className="hidden sm:block text-[11px] text-st-dim self-end font-mono shrink-0">
          Échelle 0,1 → 2,0
        </span>
      </div>

      {/* Column headers (desktop only) */}
      <div className="hidden md:grid grid-cols-[140px_120px_1fr_56px] gap-3.5 px-5 py-2 text-[9.5px] font-mono uppercase tracking-widest text-st-dim border-b border-st-border">
        <span>Rôle</span>
        <span className="text-center">Coefficient</span>
        <span>Impact relatif</span>
        <span className="text-right">Part %</span>
      </div>

      {/* Rows */}
      <div>
        {ROLE_NAMES.map((role) => (
          <CoefRow
            key={role}
            role={role}
            value={values[role]}
            original={original[role]}
            max={max}
            sum={sum}
            onChange={(v) => onChange(role, v)}
            readOnly={readOnly}
            error={errors[role]}
          />
        ))}
      </div>

      {/* Footnote */}
      <div className="px-5 py-3 border-t border-st-border bg-st-raised/30">
        <p className="text-[11px] text-st-dim leading-relaxed">
          Plus le coefficient est élevé, plus le rôle reçoit une part importante du pool, à heures
          travaillées égales.
        </p>
      </div>
    </section>
  );
}
