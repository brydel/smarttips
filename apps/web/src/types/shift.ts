import type { EmployeeRole } from './employee';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const SHIFT_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'LATE_NIGHT'] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export const SHIFT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export const ASSIGNMENT_STATUSES = ['ASSIGNED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

// ── Sub-entities ──────────────────────────────────────────────────────────────
export interface AssignmentEmployee {
  id: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  active: boolean;
}

/** A ShiftAssignment as returned inside a Shift (includes nested employee). */
export interface ShiftAssignment {
  id: string;
  tenantId: string;
  shiftId: string;
  employeeId: string;
  roleDuringShift: EmployeeRole;
  /** Prisma Decimal → coerce with Number() before arithmetic. */
  scheduledHours: number;
  /** Prisma Decimal → coerce with Number() before arithmetic. */
  hoursWorked: number | null;
  breakMinutes: number;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
  employee: AssignmentEmployee;
}

// ── Main entity ───────────────────────────────────────────────────────────────
/** Full Shift entity as returned by GET /shifts and GET /shifts/:id. */
export interface Shift {
  id: string;
  tenantId: string;
  /** ISO date string, e.g. "2026-05-21T00:00:00.000Z" — use format(new Date(date), 'PP') */
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  actualEndTime: string | null;
  status: ShiftStatus;
  notes: string | null;
  createdBy: string;
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
  assignments: ShiftAssignment[];
}

// ── Payloads ──────────────────────────────────────────────────────────────────
/** POST /shifts body — mirrors CreateShiftDto exactly. */
export interface CreateShiftPayload {
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  notes?: string;
}

/** POST /shifts/:id/assignments body — mirrors CreateAssignmentDto. */
export interface CreateAssignmentPayload {
  employeeId: string;
  scheduledHours: number;
  roleDuringShift?: EmployeeRole;
  breakMinutes?: number;
}

/** PATCH /shifts/:id/assignments/:employeeId body — mirrors UpdateAssignmentDto. */
export interface UpdateAssignmentPayload {
  hoursWorked?: number;
  breakMinutes?: number;
  checkInAt?: string;
  checkOutAt?: string;
  status?: AssignmentStatus;
}

// ── Filters ───────────────────────────────────────────────────────────────────
export interface ShiftFilters {
  date?: string; // YYYY-MM-DD
}
