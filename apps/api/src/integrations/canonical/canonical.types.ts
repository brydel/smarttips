import { IntegrationProvider } from '@prisma/client';

export type JsonPrimitive = string | number | boolean | null;
export type JsonSafeValue = JsonPrimitive | JsonSafeValue[] | { [key: string]: JsonSafeValue };
export type SourceMetadata = Record<string, JsonSafeValue>;

export type CanonicalSourceRef = {
  provider: IntegrationProvider;
  integrationAccountId: string;
  externalId: string;
  externalUpdatedAt?: string;
};

export type CanonicalBase = {
  tenantId: string;
  source: CanonicalSourceRef;
  sourceMetadata?: SourceMetadata;
};

export type CanonicalLocation = CanonicalBase & {
  name: string;
  timezone: string;
  currency: string;
  address?: SourceMetadata;
  phone?: string;
  active?: boolean;
};

export type CanonicalEmployee = CanonicalBase & {
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  employeeNumber?: string;
  active?: boolean;
};

export type CanonicalShift = CanonicalBase & {
  locationExternalId: string;
  localDate: string;
  startAt: string;
  endAt: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
  shiftType?: string;
  employeeExternalIds?: string[];
};

export type CanonicalSale = CanonicalBase & {
  locationExternalId: string;
  orderExternalId: string;
  closedAt: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  serverExternalId?: string;
  paymentExternalIds?: string[];
  status?: string;
};

export type CanonicalTip = CanonicalBase & {
  locationExternalId: string;
  tipCents: number;
  currency: string;
  receivedAt: string;
  employeeExternalId?: string;
  orderExternalId?: string;
  paymentExternalId?: string;
  tipType?: 'CARD' | 'CASH' | 'SERVICE_CHARGE' | 'DECLARED';
  allowNegative?: boolean;
};

export type CanonicalOrderItem = {
  externalId?: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type CanonicalOrder = CanonicalBase & {
  locationExternalId: string;
  orderNumber: string;
  openedAt: string;
  status: 'OPEN' | 'PAID' | 'VOIDED' | 'REFUNDED';
  totalCents: number;
  currency: string;
  closedAt?: string;
  serverExternalId?: string;
  subtotalCents?: number;
  taxCents?: number;
  tipCents?: number;
  items?: CanonicalOrderItem[];
};

export type CanonicalTimeEntry = CanonicalBase & {
  employeeExternalId: string;
  locationExternalId: string;
  clockInAt: string;
  status: 'OPEN' | 'CLOSED' | 'VOIDED';
  clockOutAt?: string;
  breakMinutes?: number;
  declaredCashTipsCents?: number;
  jobTitle?: string;
};

export type CanonicalAccountingExportLine = {
  description: string;
  amountCents: number;
  externalReference: string;
  employeeId?: string;
  accountCode?: string;
  taxCents?: number;
  classOrLocation?: string;
};

export type CanonicalAccountingExport = CanonicalBase & {
  periodStart: string;
  periodEnd: string;
  currency: string;
  lines: CanonicalAccountingExportLine[];
};

export type CanonicalEntity =
  | CanonicalLocation
  | CanonicalEmployee
  | CanonicalShift
  | CanonicalSale
  | CanonicalTip
  | CanonicalOrder
  | CanonicalTimeEntry
  | CanonicalAccountingExport;
