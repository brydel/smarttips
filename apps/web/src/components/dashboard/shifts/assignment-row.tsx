'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../../lib/cn';
import { EmployeeAvatar } from '../employee-avatar';
import type { ShiftAssignment, ShiftStatus, AssignmentStatus } from '../../../types/shift';
import type { EmployeeRole } from '../../../types/employee';

// ── Role labels ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<EmployeeRole, string> = {
  SERVER: 'Serveur',
  BUSSER: 'Runner',
  BARTENDER: 'Barman',
  COOK: 'Cuisinier',
  HOST: 'Hôte',
};

// ── Assignment status display ──────────────────────────────────────────────────

function AssignmentStatusChip({ status }: { status: AssignmentStatus }) {
  if (status === 'CHECKED_IN') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: '#818CF8',
        }}
      >
        <span
          className="shifts-pulse"
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#818CF8',
            display: 'inline-block',
          }}
        />
        en poste
      </span>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: '#34D399',
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
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        terminé
      </span>
    );
  }
  if (status === 'NO_SHOW') {
    return <span style={{ fontSize: 11, color: '#EF4444' }}>absent</span>;
  }
  return <span style={{ fontSize: 11, color: '#5A6485' }}>planifié</span>;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface AssignmentRowProps {
  assignment: ShiftAssignment;
  shiftStatus: ShiftStatus;
  onRemove: (employeeId: string) => void;
  isRemoving?: boolean;
  onUpdateHours: (employeeId: string, hours: number) => void;
  isUpdatingHours?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AssignmentRow({
  assignment,
  shiftStatus,
  onRemove,
  isRemoving = false,
  onUpdateHours,
  isUpdatingHours = false,
}: AssignmentRowProps) {
  const isLocked = shiftStatus === 'CLOSED' || shiftStatus === 'CANCELLED';
  const [worked, setWorked] = useState(
    assignment.hoursWorked !== null ? Number(assignment.hoursWorked) : 0,
  );
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep a ref to the latest `worked` value so the drag onUp closure can read it
  // without capturing a stale value (QUAL-C4).
  const workedRef = useRef(worked);
  // Cleanup ref for drag listeners — ensures they are removed on unmount (ROB-H1).
  const dragCleanupRef = useRef<(() => void) | null>(null);
  // ROB-M3: persisted value at drag start — prevents stale closure if hoursWorked prop changes mid-drag
  const persistedAtDragStartRef = useRef(0);

  useEffect(() => {
    workedRef.current = worked;
  }, [worked]);

  // Sync when prop changes (optimistic update resolved)
  useEffect(() => {
    setWorked(assignment.hoursWorked !== null ? Number(assignment.hoursWorked) : 0);
  }, [assignment.hoursWorked]);

  // Remove drag listeners on unmount to prevent memory leaks (ROB-H1).
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const scheduled = Number(assignment.scheduledHours);
  const dirty =
    Math.abs(worked - (assignment.hoursWorked !== null ? Number(assignment.hoursWorked) : 0)) >
    0.001;
  const pct = scheduled > 0 ? Math.min(100, (worked / scheduled) * 100) : 0;
  const overtime = worked > scheduled;
  const undertime = worked < scheduled && worked > 0;

  const commit = () => {
    if (editing) {
      const persisted = assignment.hoursWorked !== null ? Number(assignment.hoursWorked) : 0;
      // SEC-M6: validate bounds before calling mutation — browser constraints can be bypassed
      if (
        Number.isFinite(worked) &&
        worked >= 0 &&
        worked <= 24 &&
        Math.abs(worked - persisted) > 0.001
      ) {
        onUpdateHours(assignment.employeeId, worked);
      }
    }
    setEditing(false);
  };

  // ── Horizontal scrub drag ──────────────────────────────────────────────────
  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (editing || isLocked) return;
      e.preventDefault();
      const startX = e.clientX;
      const startV = workedRef.current;
      // ROB-M3: capture persisted value into a ref at drag-start so even if the prop
      // changes mid-drag (optimistic update resolving), onUp still uses the correct baseline.
      persistedAtDragStartRef.current =
        assignment.hoursWorked !== null ? Number(assignment.hoursWorked) : 0;

      const onMove = (mv: MouseEvent) => {
        const dx = mv.clientX - startX;
        const next = Math.max(0, Math.min(24, +(startV + dx * 0.05).toFixed(2)));
        setWorked(next);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        dragCleanupRef.current = null;
        // Persist the dragged value to the server (QUAL-C4 — was never called before).
        // SEC-M6: validate bounds before mutation.
        const v = workedRef.current;
        if (
          Number.isFinite(v) &&
          v >= 0 &&
          v <= 24 &&
          Math.abs(v - persistedAtDragStartRef.current) > 0.001
        ) {
          onUpdateHours(assignment.employeeId, v);
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      dragCleanupRef.current = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
    },
    [editing, isLocked, assignment.hoursWorked, assignment.employeeId, onUpdateHours],
  );

  const fullName = `${assignment.employee.firstName} ${assignment.employee.lastName}`;

  return (
    <div
      className={cn(isRemoving && 'opacity-40 pointer-events-none')}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 80px 1fr 110px 28px',
        gap: 14,
        alignItems: 'center',
        padding: '12px 14px',
        borderBottom: '1px solid #1B2236',
        transition: 'background .12s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = '#141A2B';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Employee */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <EmployeeAvatar
          firstName={assignment.employee.firstName}
          lastName={assignment.employee.lastName}
          role={assignment.employee.role}
          size="sm"
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#F4F6FB', fontFamily: 'var(--st-font-ui)' }}>
            {fullName}
          </div>
          <div style={{ fontSize: 11, color: '#5A6485' }}>
            {ROLE_LABEL[assignment.roleDuringShift]}
          </div>
        </div>
      </div>

      {/* Scheduled */}
      <span
        style={{
          fontSize: 12.5,
          color: '#8892B0',
          fontFamily: 'var(--st-font-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {scheduled.toFixed(1)}h
      </span>

      {/* Worked — scrub + progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          ref={inputRef}
          type="number"
          step={0.25}
          min={0}
          max={24}
          value={worked}
          disabled={isLocked || isUpdatingHours}
          onMouseDown={onMouseDown}
          onFocus={() => setEditing(true)}
          onBlur={commit}
          onChange={(e) => setWorked(parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className={cn('shifts-scrub', dirty && 'dirty')}
          style={{ cursor: isLocked ? 'not-allowed' : editing ? 'text' : 'ew-resize' }}
          title={
            isLocked
              ? 'Shift clôturé — modification impossible'
              : 'Glissez horizontalement ou cliquez pour saisir'
          }
          aria-label={`Heures réelles de ${fullName}`}
        />
        {/* Progress bar */}
        <div
          style={{
            flex: 1,
            height: 3,
            background: '#252D45',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pct}%`,
              background: overtime ? '#D4A574' : undertime ? '#F59E0B' : '#10B981',
              transition: 'all .25s ease',
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* Status */}
      <AssignmentStatusChip status={assignment.status} />

      {/* Remove */}
      <button
        onClick={() => !isLocked && onRemove(assignment.employeeId)}
        disabled={isLocked || isRemoving}
        style={{
          background: 'transparent',
          border: 0,
          color: isLocked ? '#252D45' : '#5A6485',
          padding: 6,
          borderRadius: 6,
          cursor: isLocked ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all .12s ease',
        }}
        onMouseEnter={(e) => {
          if (!isLocked) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,.1)';
            (e.currentTarget as HTMLButtonElement).style.color = '#EF4444';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = isLocked ? '#252D45' : '#5A6485';
        }}
        title={isLocked ? 'Shift clôturé' : `Retirer ${fullName} du shift`}
        aria-label={`Retirer ${fullName}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  );
}
