'use client';

import { memo, useMemo, useCallback } from 'react';
import { EmployeeAvatar } from '../employee-avatar';
import { Sparkline } from './sparkline';
import { ROLE_CONFIG } from '../../../config/employee-roles';
import { genEmployeeSparkline, normalizeCoefficient } from '../../../lib/sparkline';
import type { Employee } from '../../../types/employee';

interface EmployeeCardProps {
  employee: Employee;
  selected: boolean;
  anySelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: (id: string) => void;
}

export const EmployeeCard = memo(function EmployeeCard({
  employee: emp,
  selected,
  anySelected,
  onSelect,
  onClick,
}: EmployeeCardProps) {
  const meta = ROLE_CONFIG[emp.role];

  // Coefficient can arrive as a string from the API (Prisma decimal columns).
  // normalizeCoefficient handles string → number coercion safely (ROB-C1 / ARCH-C2).
  const safeCoeff = normalizeCoefficient(emp.coefficient);

  // Memoised so genSparkline doesn't re-run on every parent re-render (ARCH-H4).
  const sparkData = useMemo(
    () => genEmployeeSparkline({ ...emp, coefficient: safeCoeff }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emp.id, safeCoeff],
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelect(emp.id, e.target.checked);
    },
    [emp.id, onSelect],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      onClick(emp.id);
    },
    [emp.id, onClick],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') onClick(emp.id);
    },
    [emp.id, onClick],
  );

  return (
    <div
      className={`team-card team-role-${meta.cssKey}${selected ? ' selected' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        background: '#0F1422',
        borderRadius: 12,
        padding: '16px',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${emp.firstName} ${emp.lastName} — ${meta.label}`}
      aria-pressed={selected}
    >
      {/* Top row: checkbox + status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Sélectionner ${emp.firstName} ${emp.lastName}`}
          style={{
            opacity: anySelected || selected ? 1 : 0,
            transition: 'opacity .15s ease',
            width: 14,
            height: 14,
            accentColor: '#6366F1',
            cursor: 'pointer',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: emp.active ? '#34D399' : '#3A4366',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 10.5,
              color: emp.active ? '#34D399' : '#5A6485',
              fontFamily: 'var(--st-font-mono, monospace)',
            }}
          >
            {emp.active ? 'Actif' : 'Inactif'}
          </span>
        </div>
      </div>

      {/* Avatar + Name + Role */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <EmployeeAvatar
          firstName={emp.firstName}
          lastName={emp.lastName}
          role={emp.role}
          size="md"
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: '#F4F6FB',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}
          >
            {emp.firstName} {emp.lastName}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginTop: 3,
              paddingInline: '6px',
              paddingBlock: '2px',
              borderRadius: 9999,
              background: `color-mix(in oklch, ${meta.color} 14%, transparent)`,
              border: `1px solid color-mix(in oklch, ${meta.color} 25%, transparent)`,
              fontSize: 10.5,
              color: meta.color,
              fontWeight: 500,
            }}
          >
            {meta.label}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ marginBottom: 12 }}>
        <Sparkline data={sparkData} color={meta.color} width={120} height={28} />
      </div>

      {/* Bottom stats */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px solid #1B2236',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: '#5A6485',
              marginBottom: 2,
              fontFamily: 'var(--st-font-mono, monospace)',
            }}
          >
            TIPS SEM.
          </div>
          <div
            style={{ fontSize: 13, color: '#8892B0', fontFamily: 'var(--st-font-mono, monospace)' }}
          >
            —
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 10,
              color: '#5A6485',
              marginBottom: 2,
              fontFamily: 'var(--st-font-mono, monospace)',
            }}
          >
            FAIR
          </div>
          <div
            style={{
              fontSize: 13,
              color: meta.color,
              fontFamily: 'var(--st-font-mono, monospace)',
              fontWeight: 600,
            }}
          >
            ×{safeCoeff.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
});
