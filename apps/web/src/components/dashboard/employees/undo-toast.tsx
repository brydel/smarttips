'use client';

import { EmployeeAvatar } from '../employee-avatar';
import type { Employee } from '../../../types/employee';

interface UndoToastProps {
  employee: Employee | null;
  onUndo: () => void;
}

export function UndoToast({ employee: emp, onUndo }: UndoToastProps) {
  if (!emp) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${emp.firstName} ${emp.lastName} archivé — annuler dans 6 secondes`}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: '#141A2B',
        border: '1px solid #252D45',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 90,
        boxShadow: '0 8px 32px -8px rgba(0,0,0,.7)',
        animation: 'shifts-fade-up .22s cubic-bezier(.2,.7,.3,1)',
        maxWidth: 320,
      }}
    >
      {/* SVG countdown ring — keyed on employee id so animation restarts on employee change (ROB-L1) */}
      <svg
        key={emp.id}
        width={32}
        height={32}
        style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
        aria-hidden="true"
      >
        <circle cx={16} cy={16} r={14} fill="none" stroke="#1B2236" strokeWidth={3} />
        <circle
          className="team-undo-ring"
          cx={16}
          cy={16}
          r={14}
          fill="none"
          stroke="#6366F1"
          strokeWidth={3}
          strokeDasharray="88"
          strokeLinecap="round"
        />
      </svg>

      {/* Avatar + text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <EmployeeAvatar
          firstName={emp.firstName}
          lastName={emp.lastName}
          role={emp.role}
          size="sm"
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#F4F6FB',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {emp.firstName} {emp.lastName}
          </div>
          <div style={{ fontSize: 11.5, color: '#5A6485' }}>Archivé</div>
        </div>
      </div>

      {/* Undo button */}
      <button
        onClick={onUndo}
        style={{
          padding: '5px 10px',
          borderRadius: 7,
          background: 'rgba(99,102,241,.12)',
          border: '1px solid rgba(99,102,241,.3)',
          color: '#818CF8',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all .15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget;
          b.style.background = 'rgba(99,102,241,.2)';
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget;
          b.style.background = 'rgba(99,102,241,.12)';
        }}
      >
        Annuler
      </button>
    </div>
  );
}
