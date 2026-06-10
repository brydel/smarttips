'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { lockScroll, unlockScroll } from '../../../lib/scroll-lock';
import { useEmployees } from '../../../hooks/use-employees';
import { useAddAssignment } from '../../../hooks/use-shifts';
import { EmployeeAvatar } from '../employee-avatar';
import { EMPLOYEE_ROLES, type EmployeeRole, type Employee } from '../../../types/employee';
import type { ShiftStatus } from '../../../types/shift';

// ── Role labels ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<EmployeeRole, string> = {
  SERVER: 'Serveur',
  BUSSER: 'Runner',
  BARTENDER: 'Barman',
  COOK: 'Cuisinier',
  HOST: 'Hôte',
};

// ── Label style ────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--st-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontSize: 10,
  color: 'var(--st-dim)',
  fontWeight: 500,
  marginBottom: 6,
  display: 'block',
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface AddAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  shiftStatus: ShiftStatus;
  existingEmployeeIds: string[];
  onSuccess?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AddAssignmentDialog({
  open,
  onOpenChange,
  shiftId,
  shiftStatus,
  existingEmployeeIds,
  onSuccess,
}: AddAssignmentDialogProps) {
  const isLocked = shiftStatus === 'CLOSED' || shiftStatus === 'CANCELLED';
  const submittingRef = useRef(false);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [hours, setHours] = useState(4);
  const [roleOverride, setRoleOverride] = useState<EmployeeRole | null>(null);

  const { data: employees = [] } = useEmployees({ active: true });
  const addAssignment = useAddAssignment();

  const availableEmployees = useMemo(
    () => employees.filter((e) => !existingEmployeeIds.includes(e.id)),
    [employees, existingEmployeeIds],
  );

  // ROB-L2: if the selected employee becomes assigned mid-dialog (e.g., from another client),
  // clear the selection so the user can't submit a conflicting assignment.
  useEffect(() => {
    if (selectedEmployee && !availableEmployees.some((e) => e.id === selectedEmployee.id)) {
      setSelectedEmployee(null);
    }
  }, [availableEmployees, selectedEmployee]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableEmployees;
    return availableEmployees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        ROLE_LABEL[e.role].toLowerCase().includes(q),
    );
  }, [availableEmployees, search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedEmployee(null);
      setHours(4);
      setRoleOverride(null);
      submittingRef.current = false;
    }
  }, [open]);

  // Escape key + body scroll lock (reference-counted via scroll-lock.ts — ROB-H2)
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', h);
    lockScroll();
    return () => {
      window.removeEventListener('keydown', h);
      unlockScroll();
    };
  }, [open, onOpenChange]);

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setRoleOverride(emp.role);
  };

  const handleAssign = () => {
    if (isLocked || submittingRef.current || !selectedEmployee) return;
    submittingRef.current = true;
    addAssignment.mutate(
      {
        shiftId,
        payload: {
          employeeId: selectedEmployee.id,
          scheduledHours: hours,
          ...(roleOverride ? { roleDuringShift: roleOverride } : {}),
        },
      },
      {
        onSuccess: () => {
          onSuccess?.();
          onOpenChange(false);
        },
        onSettled: () => {
          submittingRef.current = false;
        },
      },
    );
  };

  if (!open) return null;

  const isPending = addAssignment.isPending;

  return (
    <div
      onClick={() => onOpenChange(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,7,15,.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="shifts-fade-up"
        style={{
          width: 560,
          maxWidth: '100%',
          maxHeight: '88vh',
          background: 'var(--st-card)',
          border: '1px solid var(--st-stroke)',
          borderRadius: 14,
          boxShadow: '0 24px 60px -20px rgba(0,0,0,.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 18px',
            borderBottom: '1px solid var(--st-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Assigner au shift</div>
            <h2
              id="dialog-title"
              className="font-display"
              style={{ fontSize: 22, color: 'var(--st-hi)', margin: 0, lineHeight: 1.15 }}
            >
              Ajouter un membre
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--st-sec)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--st-raised)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--st-hi)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--st-sec)';
            }}
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Search */}
          <div style={{ padding: '14px 20px 10px' }}>
            <div style={{ position: 'relative' }}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--st-dim)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
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
                placeholder="Rechercher un employé…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--st-raised)',
                  border: '1px solid var(--st-stroke)',
                  borderRadius: 8,
                  padding: '8px 10px 8px 32px',
                  color: 'var(--st-hi)',
                  fontFamily: 'var(--st-font-ui)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Employee list */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              minHeight: 140,
              maxHeight: 200,
              borderBottom: '1px solid var(--st-border)',
            }}
          >
            {filteredEmployees.length === 0 ? (
              <div
                style={{
                  padding: '24px 20px',
                  textAlign: 'center',
                  color: 'var(--st-dim)',
                  fontSize: 13,
                  fontFamily: 'var(--st-font-ui)',
                }}
              >
                {availableEmployees.length === 0
                  ? 'Tous les employés sont déjà assignés'
                  : 'Aucun employé trouvé'}
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedEmployee?.id === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => selectEmployee(emp)}
                    style={{
                      width: '100%',
                      background: isSelected ? 'rgba(99,102,241,.10)' : 'transparent',
                      border: 0,
                      borderBottom: '1px solid var(--st-border)',
                      padding: '10px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background .1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLButtonElement).style.background =
                          'var(--st-raised)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <EmployeeAvatar
                      firstName={emp.firstName}
                      lastName={emp.lastName}
                      role={emp.role}
                      size="sm"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--st-hi)',
                          fontFamily: 'var(--st-font-ui)',
                          fontWeight: 500,
                        }}
                      >
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--st-dim)' }}>
                        {ROLE_LABEL[emp.role]}
                      </div>
                    </div>
                    {isSelected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#818CF8"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Config section */}
          <div style={{ padding: '16px 20px' }}>
            {/* Hours stepper */}
            <div style={{ marginBottom: 16 }}>
              <span style={labelStyle}>Heures planifiées</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setHours((h) => Math.max(0.25, +(h - 0.25).toFixed(2)))}
                  disabled={isLocked || hours <= 0.25}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--st-raised)',
                    border: '1px solid var(--st-stroke)',
                    color: hours <= 0.25 ? 'var(--st-stroke)' : 'var(--st-sec)',
                    cursor: hours <= 0.25 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-label="Diminuer les heures"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <div
                  style={{
                    flex: 1,
                    height: 32,
                    background: 'var(--st-card)',
                    border: '1px solid var(--st-stroke)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 15,
                    color: 'var(--st-hi)',
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {hours.toFixed(2)}
                  <span style={{ fontSize: 11, color: 'var(--st-dim)', marginLeft: 4 }}>h</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHours((h) => Math.min(24, +(h + 0.25).toFixed(2)))}
                  disabled={isLocked || hours >= 24}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--st-raised)',
                    border: '1px solid var(--st-stroke)',
                    color: hours >= 24 ? 'var(--st-stroke)' : 'var(--st-sec)',
                    cursor: hours >= 24 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-label="Augmenter les heures"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Role override */}
            <div>
              <span style={labelStyle}>Rôle pendant le shift</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EMPLOYEE_ROLES.map((role) => {
                  const active = (roleOverride ?? selectedEmployee?.role) === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleOverride(role)}
                      disabled={isLocked}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 8,
                        background: active ? 'rgba(99,102,241,.15)' : 'var(--st-raised)',
                        border: `1px solid ${active ? '#6366F1' : 'var(--st-stroke)'}`,
                        color: active ? '#818CF8' : 'var(--st-sec)',
                        fontSize: 11.5,
                        fontFamily: 'var(--st-font-ui)',
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        transition: 'all .12s ease',
                      }}
                    >
                      {ROLE_LABEL[role]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--st-border)',
            background: 'var(--st-bg)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {isLocked ? (
            <span style={{ fontSize: 11.5, color: 'var(--st-dim)', flex: 1 }}>
              Shift {shiftStatus === 'CLOSED' ? 'clôturé' : 'annulé'} — modification impossible.
            </span>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--st-dim)', flex: 1 }}>
              {selectedEmployee
                ? `${selectedEmployee.firstName} ${selectedEmployee.lastName} sélectionné(e)`
                : `${availableEmployees.length} employé${availableEmployees.length !== 1 ? 's' : ''} disponible${availableEmployees.length !== 1 ? 's' : ''}`}
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            style={{
              background: 'transparent',
              border: '1px solid var(--st-stroke)',
              borderRadius: 10,
              padding: '7px 14px',
              color: 'var(--st-hi)',
              fontSize: 12,
              fontFamily: 'var(--st-font-ui)',
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={isLocked || !selectedEmployee || isPending}
            style={{
              background: isLocked || !selectedEmployee || isPending ? '#4F46E5' : '#6366F1',
              border: '1px solid transparent',
              borderRadius: 10,
              padding: '7px 14px',
              color: 'white',
              fontSize: 12,
              fontFamily: 'var(--st-font-ui)',
              cursor: isLocked || !selectedEmployee || isPending ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              opacity: isLocked || !selectedEmployee || isPending ? 0.5 : 1,
              transition: 'all .15s ease',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)',
            }}
          >
            {isPending ? (
              <>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Assignation…
              </>
            ) : (
              <>
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M19 8v6M22 11h-6" />
                </svg>
                Assigner
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
