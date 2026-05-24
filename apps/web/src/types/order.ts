import type { EmployeeRole } from './employee';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const ORDER_STATUSES = ['OPEN', 'SENT', 'PAID', 'VOIDED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'CARD', 'MIXED'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ── Sub-entities ──────────────────────────────────────────────────────────────
export interface OrderItemMenuItem {
  id: string;
  name: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  /** Prisma Decimal → coerce with Number() */
  unitPrice: number;
  /** Prisma Decimal → coerce with Number() */
  subtotal: number;
  notes: string | null;
  menuItem: OrderItemMenuItem;
}

export interface OrderTable {
  id: string;
  tableNumber: string;
  section: string | null;
}

export interface OrderServer {
  id: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
}

// ── Main entity ───────────────────────────────────────────────────────────────
/** Full Order entity as returned by GET /orders and GET /orders/:id. */
export interface Order {
  id: string;
  tenantId: string;
  shiftId: string;
  tableId: string;
  serverId: string;
  orderNumber: string;
  guestCount: number;
  /** Prisma Decimal → coerce with Number() */
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod | null;
  status: OrderStatus;
  openedAt: string;
  closedAt: string | null;
  durationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  table: OrderTable;
  server: OrderServer;
  items: OrderItem[];
}

// ── Payloads ──────────────────────────────────────────────────────────────────
export interface CreateOrderItemPayload {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

/** POST /orders body — mirrors CreateOrderDto exactly. */
export interface CreateOrderPayload {
  shiftId: string;
  tableId: string;
  serverId: string;
  guestCount?: number;
  items: CreateOrderItemPayload[];
}

// ── Filters ───────────────────────────────────────────────────────────────────
export interface OrderFilters {
  shiftId?: string;
  serverId?: string;
  tableId?: string;
  status?: OrderStatus;
  limit?: number;
}
