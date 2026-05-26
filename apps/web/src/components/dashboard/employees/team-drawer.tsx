'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Archive, Calendar, Save, XCircle, Mail } from 'lucide-react';
import { format, isValid, differenceInMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EmployeeAvatar } from '../employee-avatar';
import { Sparkline } from './sparkline';
import { ROLE_CONFIG, ROLE_ORDER } from '../../../config/employee-roles';
import { genEmployeeSparkline, normalizeCoefficient } from '../../../lib/sparkline';
import type { Employee, EmployeeRole, UpdateEmployeePayload } from '../../../types/employee';

interface TeamDrawerProps {
  employee: Employee | null;
  onClose: () => void;
  onArchive: (emp: Employee) => void;
  /** Called with (id, payload) — parent controls when to close the drawer. */
  onSave: (id: string, payload: UpdateEmployeePayload) => void;
  saving?: boolean;
  /** Appelé quand l'utilisateur clique "Inviter" sur un employé sans compte. */
  onInvite?: (emp: Employee) => void;
}

interface EditState {
  firstName: string;
  lastName: string;
  email: string;
  role: EmployeeRole;
  hourlyWage: string;
  coefficient: string;
}

export function TeamDrawer({
  employee: emp,
  onClose,
  onArchive,
  onSave,
  saving = false,
  onInvite,
}: TeamDrawerProps) {
  const [editMode, setEditMode] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  // Tracks mount status to avoid calling onSave after unmount (ROB-H1 pattern).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync edit state whenever the employee changes
  useEffect(() => {
    if (!emp) {
      setEditMode(false);
      setEditState(null);
      return;
    }
    setEditState({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email ?? '',
      role: emp.role,
      hourlyWage: normalizeCoefficient(emp.hourlyWage).toFixed(2),
      coefficient: normalizeCoefficient(emp.coefficient).toFixed(2),
    });
  }, [emp]);

  // Also reset edit mode when the drawer closes
  useEffect(() => {
    if (!emp) setEditMode(false);
  }, [emp]);

  // Escape key handling
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (editMode) setEditMode(false);
      else onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editMode, onClose]);

  // Focus first input when entering edit mode
  useEffect(() => {
    if (!editMode) return;
    // Cleaned-up timeout (QUAL-M2): store id so it can be cancelled on unmount.
    const id = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [editMode]);

  const handleSave = useCallback(() => {
    if (!emp || !editState || !mountedRef.current) return;

    // Use Number.isFinite to correctly handle intentional 0 values (ROB-H5).
    const parsedWage = parseFloat(editState.hourlyWage);
    const parsedCoeff = parseFloat(editState.coefficient);

    // Lightweight input validation
    const firstName = editState.firstName.trim();
    const lastName = editState.lastName.trim();
    if (firstName.length < 2 || firstName.length > 100) return;
    if (lastName.length < 2 || lastName.length > 100) return;

    const payload: UpdateEmployeePayload = {
      firstName,
      lastName,
      email: editState.email.trim() || undefined,
      role: editState.role,
      hourlyWage: Number.isFinite(parsedWage) ? parsedWage : emp.hourlyWage,
      coefficient: Number.isFinite(parsedCoeff) ? parsedCoeff : emp.coefficient,
    };

    // ROB-H2: do NOT setEditMode(false) here.
    // The parent calls setDrawerId(null) onSuccess — that unmounts this component.
    // If save fails, the drawer stays open in edit mode so the user can retry.
    onSave(emp.id, payload);
  }, [emp, editState, onSave]);

  const handleCancel = useCallback(() => {
    if (!emp) return;
    setEditState({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email ?? '',
      role: emp.role,
      hourlyWage: normalizeCoefficient(emp.hourlyWage).toFixed(2),
      coefficient: normalizeCoefficient(emp.coefficient).toFixed(2),
    });
    setEditMode(false);
  }, [emp]);

  // ARCH-H4: useMemo must be called before any early return (Rules of Hooks).
  // We guard emp inside the factory; when null the function returns [] which is cheap.
  const safeCoeff = normalizeCoefficient(emp?.coefficient ?? 1);
  const sparkData = useMemo(
    () => (emp ? genEmployeeSparkline({ ...emp, coefficient: safeCoeff }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emp?.id, safeCoeff],
  );

  if (!emp || !editState) return null;

  const meta = ROLE_CONFIG[emp.role];
  const editMeta = ROLE_CONFIG[editState.role];
  const fairStr = `×${safeCoeff.toFixed(2)}`;

  const hireDateDisplay = emp.hireDate
    ? (() => {
        const d = new Date(emp.hireDate + 'T12:00:00');
        if (!isValid(d)) return null;
        const months = differenceInMonths(new Date(), d);
        const label = format(d, 'MMMM yyyy', { locale: fr });
        return { label, months };
      })()
    : null;

  const activeMeta = editMode ? editMeta : meta;

  return (
    <>
      {/* Overlay */}
      <div
        className="team-drawer-overlay"
        onClick={editMode ? undefined : onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,26,.55)', zIndex: 40 }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className="team-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 460,
          background: '#0F1422',
          borderLeft: '1px solid #1B2236',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, ${activeMeta.tint}, transparent)`,
            borderBottom: '1px solid #1B2236',
            padding: '20px 20px 16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <EmployeeAvatar
                firstName={emp.firstName}
                lastName={emp.lastName}
                role={editMode ? editState.role : emp.role}
                size="xl"
              />
              <div>
                {editMode ? (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <input
                      ref={firstInputRef}
                      className="team-editable"
                      value={editState.firstName}
                      onChange={(e) =>
                        setEditState((s) => s && { ...s, firstName: e.target.value })
                      }
                      placeholder="Prénom"
                      maxLength={100}
                      style={{ width: 100, fontSize: 15, fontWeight: 600 }}
                      aria-label="Prénom"
                    />
                    <input
                      className="team-editable"
                      value={editState.lastName}
                      onChange={(e) => setEditState((s) => s && { ...s, lastName: e.target.value })}
                      placeholder="Nom"
                      maxLength={100}
                      style={{ width: 100, fontSize: 15, fontWeight: 600 }}
                      aria-label="Nom"
                    />
                  </div>
                ) : (
                  <h2
                    id="drawer-title"
                    style={{ fontSize: 17, fontWeight: 700, color: '#F4F6FB', marginBottom: 5 }}
                  >
                    {emp.firstName} {emp.lastName}
                  </h2>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 8px',
                      borderRadius: 9999,
                      background: `color-mix(in oklch, ${activeMeta.color} 14%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${activeMeta.color} 25%, transparent)`,
                      fontSize: 11,
                      color: activeMeta.color,
                      fontWeight: 500,
                    }}
                  >
                    {editMode ? ROLE_CONFIG[editState.role].labelShort : meta.label}
                  </span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: emp.active ? '#34D399' : '#3A4366',
                    }}
                  />
                  <span style={{ fontSize: 11, color: emp.active ? '#34D399' : '#5A6485' }}>
                    {emp.active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
            </div>
            <CloseButton onClick={onClose} />
          </div>

          {/* KPI strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: '#1B2236',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {[
              { label: 'CETTE SEM.', value: '—' },
              { label: 'SHIFTS / MOIS', value: '—' },
              { label: 'AVG / SHIFT', value: '—' },
              { label: 'FAIR', value: fairStr, highlight: true },
            ].map((kpi) => (
              <div
                key={kpi.label}
                style={{ background: '#141A2B', padding: '10px 8px', textAlign: 'center' }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: '#5A6485',
                    fontFamily: 'var(--st-font-mono, monospace)',
                    marginBottom: 4,
                  }}
                >
                  {kpi.label}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: kpi.highlight ? meta.color : '#F4F6FB',
                    fontFamily: 'var(--st-font-mono, monospace)',
                  }}
                >
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body (scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Tips trend */}
          <section style={{ marginBottom: 20 }}>
            <SectionLabel>TENDANCE TIPS (8 DERNIERS SERVICES)</SectionLabel>
            <div
              style={{
                background: '#141A2B',
                borderRadius: 10,
                padding: '14px 16px',
                border: '1px solid #1B2236',
              }}
            >
              <Sparkline data={sparkData} color={meta.color} width={380} height={48} />
              <div style={{ marginTop: 6, fontSize: 10.5, color: '#5A6485', fontStyle: 'italic' }}>
                Tendance estimée · données réelles disponibles à venir
              </div>
            </div>
          </section>

          {/* Contact */}
          <section style={{ marginBottom: 20 }}>
            <SectionLabel>CONTACT</SectionLabel>
            <div
              style={{
                background: '#141A2B',
                borderRadius: 10,
                border: '1px solid #1B2236',
                overflow: 'hidden',
              }}
            >
              <ContactRow label="Email">
                {editMode ? (
                  <input
                    className="team-editable"
                    type="email"
                    value={editState.email}
                    onChange={(e) => setEditState((s) => s && { ...s, email: e.target.value })}
                    placeholder="email@restaurant.com"
                    maxLength={254}
                    aria-label="Email"
                  />
                ) : (
                  <span style={{ fontSize: 13, color: '#C5CCE0' }}>{emp.email ?? '—'}</span>
                )}
              </ContactRow>
              <ContactRow label="Téléphone">
                <span style={{ fontSize: 13, color: '#8892B0' }}>—</span>
              </ContactRow>
              <ContactRow label="Embauche" last>
                <div>
                  <span style={{ fontSize: 13, color: '#C5CCE0' }}>
                    {hireDateDisplay ? hireDateDisplay.label : '—'}
                  </span>
                  {hireDateDisplay && (
                    <span style={{ fontSize: 11, color: '#5A6485', marginLeft: 8 }}>
                      ({hireDateDisplay.months} mois)
                    </span>
                  )}
                </div>
              </ContactRow>
            </div>
          </section>

          {/* Compensation */}
          <section style={{ marginBottom: 20 }}>
            <SectionLabel>RÉMUNÉRATION</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <KpiCard label="TAUX HORAIRE">
                {editMode ? (
                  <input
                    className="team-editable"
                    type="number"
                    step="0.25"
                    min="0"
                    max="200"
                    value={editState.hourlyWage}
                    onChange={(e) => setEditState((s) => s && { ...s, hourlyWage: e.target.value })}
                    aria-label="Taux horaire"
                    style={{
                      fontFamily: 'var(--st-font-mono, monospace)',
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#F4F6FB',
                      fontFamily: 'var(--st-font-mono, monospace)',
                    }}
                  >
                    {normalizeCoefficient(emp.hourlyWage).toFixed(2)}$
                  </span>
                )}
              </KpiCard>
              <KpiCard label="COEFFICIENT">
                {editMode ? (
                  <input
                    className="team-editable"
                    type="number"
                    step="0.05"
                    min="0"
                    max="10"
                    value={editState.coefficient}
                    onChange={(e) =>
                      setEditState((s) => s && { ...s, coefficient: e.target.value })
                    }
                    aria-label="Coefficient"
                    style={{
                      fontFamily: 'var(--st-font-mono, monospace)',
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: meta.color,
                      fontFamily: 'var(--st-font-mono, monospace)',
                    }}
                  >
                    ×{normalizeCoefficient(emp.coefficient).toFixed(2)}
                  </span>
                )}
              </KpiCard>
            </div>

            {editMode && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: '#5A6485',
                    marginBottom: 6,
                    fontFamily: 'var(--st-font-mono, monospace)',
                  }}
                >
                  RÔLE
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ROLE_ORDER.map((r) => {
                    const rm = ROLE_CONFIG[r];
                    const active = editState.role === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setEditState((s) => s && { ...s, role: r })}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 9999,
                          border: `1px solid ${active ? rm.color : '#252D45'}`,
                          background: active
                            ? `color-mix(in oklch, ${rm.color} 14%, transparent)`
                            : 'transparent',
                          color: active ? rm.color : '#8892B0',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'all .15s ease',
                        }}
                      >
                        {rm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Notes (read-only — notes not in UpdateEmployeePayload) */}
          <section>
            <SectionLabel>NOTES</SectionLabel>
            <div
              style={{
                background: '#141A2B',
                borderRadius: 10,
                border: '1px solid #1B2236',
                padding: '12px 14px',
                minHeight: 72,
                fontSize: 13,
                color: emp.notes ? '#C5CCE0' : '#3A4366',
                lineHeight: 1.6,
                fontStyle: emp.notes ? 'normal' : 'italic',
              }}
            >
              {/* TODO: add maxLength={500} + Zod validation if notes becomes editable */}
              {emp.notes ?? 'Aucune note'}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #1B2236',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#0A0E1A',
            flexShrink: 0,
          }}
        >
          {editMode ? (
            <>
              <GhostButton onClick={handleCancel}>
                <XCircle size={13} /> Annuler
              </GhostButton>
              <PrimaryButton onClick={handleSave} loading={saving}>
                <Save size={13} />
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </PrimaryButton>
            </>
          ) : (
            <>
              <DangerButton onClick={() => onArchive(emp)}>
                <Archive size={13} /> Archiver
              </DangerButton>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Bouton Inviter : visible seulement si l'employé n'a pas encore de compte */}
                {!emp.userId && onInvite && (
                  <GhostButton
                    onClick={() => onInvite(emp)}
                    aria-label="Envoyer une invitation par email"
                    title="Envoyer un lien d'invitation"
                  >
                    <Mail size={13} /> Inviter
                  </GhostButton>
                )}
                <GhostButton
                  onClick={() => {}}
                  aria-label="Planning (à venir)"
                  title="Fonctionnalité à venir"
                >
                  <Calendar size={13} /> Planning
                </GhostButton>
                <GhostButton onClick={() => setEditMode(true)}>Éditer</GhostButton>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Mini layout helpers ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: '#5A6485',
        marginBottom: 10,
        fontWeight: 600,
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </div>
  );
}

function ContactRow({
  label,
  last = false,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr',
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: last ? 'none' : '1px solid #1B2236',
      }}
    >
      <span style={{ fontSize: 11, color: '#5A6485' }}>{label}</span>
      {children}
    </div>
  );
}

function KpiCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#141A2B',
        borderRadius: 10,
        border: '1px solid #1B2236',
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#5A6485',
          marginBottom: 6,
          fontFamily: 'var(--st-font-mono, monospace)',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Fermer"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: '#5A6485',
        padding: 4,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        transition: 'color .15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = '#F4F6FB';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = '#5A6485';
      }}
    >
      <X size={16} />
    </button>
  );
}

function GhostButton({
  onClick,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 8,
        background: 'transparent',
        border: '1px solid #252D45',
        color: '#8892B0',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all .15s ease',
        ...(rest.style ?? {}),
      }}
      onMouseEnter={(e) => {
        const b = e.currentTarget;
        b.style.borderColor = '#3A4366';
        b.style.color = '#F4F6FB';
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget;
        b.style.borderColor = '#252D45';
        b.style.color = '#8892B0';
      }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  onClick,
  loading,
  children,
}: {
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 16px',
        borderRadius: 8,
        background: loading ? '#3730A3' : '#6366F1',
        border: '1px solid transparent',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'background .15s ease',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function DangerButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 8,
        background: 'transparent',
        border: '1px solid rgba(239,68,68,.3)',
        color: '#EF4444',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all .15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}
