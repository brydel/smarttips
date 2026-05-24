'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ShiftTypeChip,
  SHIFT_TYPE_CFG,
} from '../../../../../components/dashboard/shifts/shift-type-chip';
import { ShiftStatusBadge } from '../../../../../components/dashboard/shifts/shift-status-badge';
import { AssignmentRow } from '../../../../../components/dashboard/shifts/assignment-row';
import { OrderTicket } from '../../../../../components/dashboard/shifts/order-ticket';
import { AddAssignmentDialog } from '../../../../../components/dashboard/shifts/add-assignment-dialog';
import { CloseShiftDialog } from '../../../../../components/dashboard/shifts/close-shift-dialog';
import { CreateOrderDialog } from '../../../../../components/dashboard/shifts/create-order-dialog';
import {
  useShift,
  useRemoveAssignment,
  useUpdateAssignment,
} from '../../../../../hooks/use-shifts';
import { useOrders } from '../../../../../hooks/use-orders';
import { useTipPool } from '../../../../../hooks/use-tip-pools';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  // Use parseISO (date-fns) for consistent local-time parsing — new Date(iso) can
  // behave differently across browsers for strings without a timezone offset (ROB-C3).
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    // Use date-only prefix so parseISO treats it as LOCAL midnight, not UTC midnight.
    // "2026-05-21T00:00:00.000Z" → parseISO("2026-05-21") → May 21 local (correct).
    const d = parseISO(iso.split('T')[0] ?? iso);
    const label = format(d, 'EEEE d MMMM yyyy', { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return iso;
  }
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--st-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontSize: 10,
  color: '#5A6485',
  fontWeight: 500,
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ShiftDetailPage() {
  const params = useParams<{ id: string }>();
  // Safely extract id — avoids non-null assertion on potentially empty array (ROB-H3).
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = rawId ?? '';
  const router = useRouter();

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);

  const { data: shift, isLoading, isError } = useShift(id);
  // ROB-M1: useOrders already has enabled: Boolean(filters.shiftId) guard built-in; id='' when SSR so it won't fire.
  const { data: orders = [], isLoading: ordersLoading } = useOrders({ shiftId: id });
  const { data: tipPool } = useTipPool(id, { enabled: shift?.status === 'CLOSED' });
  const removeAssignment = useRemoveAssignment();
  const updateAssignment = useUpdateAssignment();

  // Memoised to prevent all AssignmentRow children re-rendering on each parent render.
  // Must be defined before early returns to satisfy Rules of Hooks.
  const handleRemoveAssignment = useCallback(
    (employeeId: string) => {
      if (!shift) return;
      removeAssignment.mutate({ shiftId: shift.id, employeeId });
    },
    [removeAssignment, shift],
  );

  const handleUpdateHours = useCallback(
    (employeeId: string, hours: number) => {
      if (!shift) return;
      updateAssignment.mutate({ shiftId: shift.id, employeeId, payload: { hoursWorked: hours } });
    },
    [updateAssignment, shift],
  );

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0E1A',
        }}
      >
        <p style={{ fontSize: 13, color: '#5A6485', fontFamily: 'var(--st-font-ui)' }}>
          Chargement du shift…
        </p>
      </div>
    );
  }

  if (isError || !shift) {
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: '#0A0E1A',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3A4366"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <p style={{ fontSize: 13, color: '#8892B0', fontFamily: 'var(--st-font-ui)' }}>
          Shift introuvable ou erreur de chargement.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/shifts')}
          style={{
            background: 'transparent',
            border: '1px solid #252D45',
            borderRadius: 8,
            padding: '7px 14px',
            color: '#8892B0',
            fontSize: 12,
            fontFamily: 'var(--st-font-ui)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
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
            <path d="m15 18-6-6 6-6" />
          </svg>
          Retour aux shifts
        </button>
      </div>
    );
  }

  const isLocked = shift.status === 'CLOSED' || shift.status === 'CANCELLED';
  const existingEmployeeIds = shift.assignments.map((a) => a.employeeId);
  const cfg = SHIFT_TYPE_CFG[shift.shiftType];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className={cfg.cssClass}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: '#0A0E1A',
      }}
    >
      {/* Scroll container */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.push('/dashboard/shifts')}
          style={{
            background: 'transparent',
            border: 0,
            padding: '0 0 16px 0',
            color: '#5A6485',
            fontSize: 12,
            fontFamily: 'var(--st-font-ui)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'color .12s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#8892B0';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#5A6485';
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Shifts
        </button>

        {/* Shift header card */}
        <div
          style={{
            background: '#0F1422',
            border: `1px solid ${shift.status === 'IN_PROGRESS' ? 'var(--type-c)' : '#1B2236'}`,
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 22,
            boxShadow:
              shift.status === 'IN_PROGRESS'
                ? '0 0 0 1px color-mix(in srgb, var(--type-c) 15%, transparent), 0 12px 30px -12px color-mix(in srgb, var(--type-c) 20%, transparent)'
                : 'none',
          }}
        >
          {/* RESP-H7: shift-header-card-inner stacks vertically on mobile */}
          <div
            className="shift-header-card-inner"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            {/* Left: info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <ShiftTypeChip type={shift.shiftType} />
                <ShiftStatusBadge status={shift.status} />
                {shift.status === 'IN_PROGRESS' && (
                  <span
                    className="shifts-pulse"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--type-c)',
                      display: 'inline-block',
                    }}
                  />
                )}
              </div>
              <h1
                className="font-display"
                style={{ fontSize: 28, color: '#F4F6FB', margin: '0 0 8px', lineHeight: 1.1 }}
              >
                {formatDate(shift.date)}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                {/* Time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#5A6485"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span
                    style={{
                      fontFamily: 'var(--st-font-mono)',
                      fontSize: 13,
                      color: '#8892B0',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                  </span>
                  {shift.actualEndTime && (
                    <span
                      style={{ fontSize: 11, color: '#5A6485', fontFamily: 'var(--st-font-ui)' }}
                    >
                      · fin réelle {formatTime(shift.actualEndTime)}
                    </span>
                  )}
                </div>
                {/* Team count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#5A6485"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span style={{ fontSize: 12, color: '#8892B0', fontFamily: 'var(--st-font-ui)' }}>
                    {shift.assignments.length} membre{shift.assignments.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Orders count */}
                {!ordersLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#5A6485"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 7h16M4 7v12M20 7v12M8 7v4M16 7v4M4 11h16" />
                    </svg>
                    <span
                      style={{ fontSize: 12, color: '#8892B0', fontFamily: 'var(--st-font-ui)' }}
                    >
                      {orders.length} commande{orders.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              {shift.notes && (
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 12.5,
                    color: '#8892B0',
                    fontFamily: 'var(--st-font-ui)',
                    lineHeight: 1.5,
                    maxWidth: 480,
                  }}
                >
                  {shift.notes}
                </p>
              )}
            </div>

            {/* Right: actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setCloseDialogOpen(true)}
                disabled={isLocked}
                style={{
                  background: isLocked ? 'transparent' : '#6366F1',
                  border: isLocked ? '1px solid #252D45' : '1px solid transparent',
                  borderRadius: 10,
                  padding: '8px 16px',
                  color: isLocked ? '#3A4366' : 'white',
                  fontSize: 12,
                  fontFamily: 'var(--st-font-ui)',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  boxShadow: isLocked ? 'none' : 'inset 0 1px 0 rgba(255,255,255,.18)',
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Clôturer le shift
              </button>
              <button
                type="button"
                onClick={() => setCreateOrderOpen(true)}
                disabled
                title="En attente de BIS-43 — tables non disponibles"
                style={{
                  background: 'transparent',
                  border: '1px solid #252D45',
                  borderRadius: 10,
                  padding: '8px 16px',
                  color: '#3A4366',
                  fontSize: 12,
                  fontFamily: 'var(--st-font-ui)',
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  opacity: 0.5,
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
                Nouvelle commande
              </button>
            </div>
          </div>
        </div>

        {/* Tip pool card — only when CLOSED and pool exists */}
        {shift.status === 'CLOSED' && tipPool && (
          <div
            style={{
              background: '#0F1422',
              border: '1px solid rgba(52,211,153,.2)',
              borderRadius: 12,
              padding: '14px 20px',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(52,211,153,.1)',
                  border: '1px solid rgba(52,211,153,.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <div style={{ ...labelStyle, marginBottom: 1, color: '#34D399' }}>
                  Pool de pourboires
                </div>
                <div
                  style={{
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 20,
                    color: '#F4F6FB',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Number(tipPool.totalAmount).toFixed(2)} $
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...labelStyle, marginBottom: 2, color: '#D4A574' }}>Espèces</div>
                <span style={{ fontFamily: 'var(--st-font-mono)', fontSize: 14, color: '#D4A574' }}>
                  {Number(tipPool.cashAmount).toFixed(2)} $
                </span>
              </div>
              <div style={{ width: 1, background: '#1B2236' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...labelStyle, marginBottom: 2, color: '#818CF8' }}>Carte</div>
                <span style={{ fontFamily: 'var(--st-font-mono)', fontSize: 14, color: '#818CF8' }}>
                  {Number(tipPool.cardAmount).toFixed(2)} $
                </span>
              </div>
              <div style={{ width: 1, background: '#1B2236' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...labelStyle, marginBottom: 2 }}>Statut</div>
                <span
                  style={{
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 11,
                    color: '#8892B0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {tipPool.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Split layout: team + orders — RESP-C2: responsive via .shift-detail-grid CSS class */}
        <div className="shift-detail-grid" style={{ alignItems: 'start' }}>
          {/* LEFT: Team panel */}
          <div
            style={{
              background: '#0F1422',
              border: '1px solid #1B2236',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Team header */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #1B2236',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5A6485"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span
                  style={{
                    fontSize: 13,
                    color: '#F4F6FB',
                    fontFamily: 'var(--st-font-ui)',
                    fontWeight: 500,
                  }}
                >
                  Équipe
                </span>
                <span
                  style={{
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 11,
                    color: '#5A6485',
                    background: '#141A2B',
                    border: '1px solid #252D45',
                    borderRadius: 6,
                    padding: '1px 7px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {shift.assignments.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAddAssignmentOpen(true)}
                disabled={isLocked}
                style={{
                  background: isLocked ? 'transparent' : '#141A2B',
                  border: '1px solid #252D45',
                  borderRadius: 8,
                  padding: '5px 10px',
                  color: isLocked ? '#252D45' : '#8892B0',
                  fontSize: 11.5,
                  fontFamily: 'var(--st-font-ui)',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M19 8v6M22 11h-6" />
                </svg>
                Ajouter
              </button>
            </div>

            {/* Column headers */}
            {shift.assignments.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.6fr 80px 1fr 110px 28px',
                  gap: 14,
                  padding: '8px 14px',
                  borderBottom: '1px solid #1B2236',
                }}
              >
                {['Employé', 'Planifié', 'Réalisé', 'Statut', ''].map((h, i) => (
                  <span key={i} style={{ ...labelStyle, marginBottom: 0, fontSize: 9.5 }}>
                    {h}
                  </span>
                ))}
              </div>
            )}

            {/* Assignment rows */}
            {shift.assignments.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p
                  style={{
                    fontSize: 13,
                    color: '#5A6485',
                    fontFamily: 'var(--st-font-ui)',
                    marginBottom: 12,
                  }}
                >
                  Aucun employé assigné
                </p>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => setAddAssignmentOpen(true)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #252D45',
                      borderRadius: 8,
                      padding: '6px 14px',
                      color: '#8892B0',
                      fontSize: 12,
                      fontFamily: 'var(--st-font-ui)',
                      cursor: 'pointer',
                    }}
                  >
                    Ajouter le premier employé
                  </button>
                )}
              </div>
            ) : (
              shift.assignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  shiftStatus={shift.status}
                  onRemove={handleRemoveAssignment}
                  isRemoving={
                    removeAssignment.isPending &&
                    removeAssignment.variables?.employeeId === assignment.employeeId
                  }
                  onUpdateHours={handleUpdateHours}
                  isUpdatingHours={
                    updateAssignment.isPending &&
                    updateAssignment.variables?.employeeId === assignment.employeeId
                  }
                />
              ))
            )}
          </div>

          {/* RIGHT: Orders panel */}
          <div
            style={{
              background: '#0F1422',
              border: '1px solid #1B2236',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Orders header */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #1B2236',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5A6485"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h16M4 7v12M20 7v12M8 7v4M16 7v4M4 11h16" />
                </svg>
                <span
                  style={{
                    fontSize: 13,
                    color: '#F4F6FB',
                    fontFamily: 'var(--st-font-ui)',
                    fontWeight: 500,
                  }}
                >
                  Commandes
                </span>
                <span
                  style={{
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 11,
                    color: '#5A6485',
                    background: '#141A2B',
                    border: '1px solid #252D45',
                    borderRadius: 6,
                    padding: '1px 7px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {orders.length}
                </span>
              </div>
              {/* Orders total */}
              {orders.length > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--st-font-mono)',
                    fontSize: 13,
                    color: '#34D399',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                  }}
                >
                  {orders.reduce((s, o) => s + Number(o.totalAmount), 0).toFixed(2)} $
                </span>
              )}
            </div>

            {/* Orders list */}
            {ordersLoading ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#5A6485', fontFamily: 'var(--st-font-ui)' }}>
                  Chargement…
                </p>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#5A6485', fontFamily: 'var(--st-font-ui)' }}>
                  Aucune commande
                </p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {orders.map((order) => (
                  <OrderTicket key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CloseShiftDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        shift={shift}
        existingTipPool={tipPool ?? null}
      />
      <AddAssignmentDialog
        open={addAssignmentOpen}
        onOpenChange={setAddAssignmentOpen}
        shiftId={shift.id}
        shiftStatus={shift.status}
        existingEmployeeIds={existingEmployeeIds}
      />
      <CreateOrderDialog open={createOrderOpen} onOpenChange={setCreateOrderOpen} shift={shift} />
    </div>
  );
}
