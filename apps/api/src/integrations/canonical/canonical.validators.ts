import { IntegrationProvider } from '@prisma/client';

import {
  CanonicalAccountingExport,
  CanonicalEmployee,
  CanonicalLocation,
  CanonicalOrder,
  CanonicalSale,
  CanonicalShift,
  CanonicalSourceRef,
  CanonicalTimeEntry,
  CanonicalTip,
  SourceMetadata,
} from './canonical.types';
import { ProviderValidationError } from '../errors/connector.errors';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const UNSAFE_METADATA_KEY_PATTERN =
  /(raw|payload|body|headers?|authorization|token|secret|api[-_]?key|password|credential|cookie)/i;

export type CanonicalValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateCanonicalLocation(value: CanonicalLocation): CanonicalValidationResult {
  const errors = baseErrors(value);
  requireNonEmpty(value.name, 'location.name', errors);
  requireNonEmpty(value.timezone, 'location.timezone', errors);
  requireCurrency(value.currency, 'location.currency', errors);
  return result(errors);
}

export function validateCanonicalEmployee(value: CanonicalEmployee): CanonicalValidationResult {
  const errors = baseErrors(value);
  requireNonEmpty(value.displayName, 'employee.displayName', errors);
  return result(errors);
}

export function validateCanonicalShift(value: CanonicalShift): CanonicalValidationResult {
  const errors = baseErrors(value);
  requireNonEmpty(value.locationExternalId, 'shift.locationExternalId', errors);
  requireNonEmpty(value.localDate, 'shift.localDate', errors);
  requireDate(value.startAt, 'shift.startAt', errors);
  requireDate(value.endAt, 'shift.endAt', errors);
  requireOrderedDates(value.startAt, value.endAt, 'shift.startAt', 'shift.endAt', errors);
  return result(errors);
}

export function validateCanonicalSale(value: CanonicalSale): CanonicalValidationResult {
  const errors = baseErrors(value);
  requireNonEmpty(value.locationExternalId, 'sale.locationExternalId', errors);
  requireNonEmpty(value.orderExternalId, 'sale.orderExternalId', errors);
  requireDate(value.closedAt, 'sale.closedAt', errors);
  requireCurrency(value.currency, 'sale.currency', errors);
  requireMoney(value.subtotalCents, 'sale.subtotalCents', errors);
  requireMoney(value.taxCents, 'sale.taxCents', errors);
  requireMoney(value.totalCents, 'sale.totalCents', errors);

  if (isInteger(value.subtotalCents) && isInteger(value.taxCents) && isInteger(value.totalCents)) {
    const minimumTotal = value.subtotalCents + value.taxCents;
    if (value.totalCents < minimumTotal) {
      errors.push('sale.totalCents must be greater than or equal to subtotalCents + taxCents');
    }
  }

  return result(errors);
}

export function validateCanonicalTip(value: CanonicalTip): CanonicalValidationResult {
  const errors = baseErrors(value);
  requireNonEmpty(value.locationExternalId, 'tip.locationExternalId', errors);
  requireDate(value.receivedAt, 'tip.receivedAt', errors);
  requireCurrency(value.currency, 'tip.currency', errors);
  requireMoney(value.tipCents, 'tip.tipCents', errors, { allowNegative: value.allowNegative });
  return result(errors);
}

export function validateCanonicalOrder(value: CanonicalOrder): CanonicalValidationResult {
  const errors = baseErrors(value);
  requireNonEmpty(value.locationExternalId, 'order.locationExternalId', errors);
  requireNonEmpty(value.orderNumber, 'order.orderNumber', errors);
  requireDate(value.openedAt, 'order.openedAt', errors);
  if (value.closedAt) {
    requireDate(value.closedAt, 'order.closedAt', errors);
    requireOrderedDates(value.openedAt, value.closedAt, 'order.openedAt', 'order.closedAt', errors);
  }
  requireCurrency(value.currency, 'order.currency', errors);
  requireMoney(value.totalCents, 'order.totalCents', errors, {
    allowNegative: value.status === 'REFUNDED',
  });

  if (value.subtotalCents !== undefined) {
    requireMoney(value.subtotalCents, 'order.subtotalCents', errors);
  }
  if (value.taxCents !== undefined) {
    requireMoney(value.taxCents, 'order.taxCents', errors);
  }
  if (value.tipCents !== undefined) {
    requireMoney(value.tipCents, 'order.tipCents', errors);
  }
  if (
    value.subtotalCents !== undefined &&
    value.taxCents !== undefined &&
    isInteger(value.subtotalCents) &&
    isInteger(value.taxCents) &&
    isInteger(value.totalCents)
  ) {
    const minimumTotal = value.subtotalCents + value.taxCents + (value.tipCents ?? 0);
    if (value.totalCents < minimumTotal && value.status !== 'REFUNDED') {
      errors.push('order.totalCents must reconcile with subtotalCents + taxCents + tipCents');
    }
  }

  return result(errors);
}

export function validateCanonicalTimeEntry(value: CanonicalTimeEntry): CanonicalValidationResult {
  const errors = baseErrors(value);
  requireNonEmpty(value.employeeExternalId, 'timeEntry.employeeExternalId', errors);
  requireNonEmpty(value.locationExternalId, 'timeEntry.locationExternalId', errors);
  requireDate(value.clockInAt, 'timeEntry.clockInAt', errors);
  if (value.clockOutAt) {
    requireDate(value.clockOutAt, 'timeEntry.clockOutAt', errors);
    requireOrderedDates(
      value.clockInAt,
      value.clockOutAt,
      'timeEntry.clockInAt',
      'timeEntry.clockOutAt',
      errors,
    );
  }
  if (value.status === 'CLOSED' && !value.clockOutAt) {
    errors.push('timeEntry.clockOutAt is required when status is CLOSED');
  }
  if (
    value.breakMinutes !== undefined &&
    (!Number.isInteger(value.breakMinutes) || value.breakMinutes < 0)
  ) {
    errors.push('timeEntry.breakMinutes must be a non-negative integer');
  }
  if (value.declaredCashTipsCents !== undefined) {
    requireMoney(value.declaredCashTipsCents, 'timeEntry.declaredCashTipsCents', errors);
  }
  return result(errors);
}

export function validateCanonicalAccountingExport(
  value: CanonicalAccountingExport,
): CanonicalValidationResult {
  const errors = baseErrors(value);
  requireDate(value.periodStart, 'accountingExport.periodStart', errors);
  requireDate(value.periodEnd, 'accountingExport.periodEnd', errors);
  requireOrderedDates(
    value.periodStart,
    value.periodEnd,
    'accountingExport.periodStart',
    'accountingExport.periodEnd',
    errors,
  );
  requireCurrency(value.currency, 'accountingExport.currency', errors);
  if (!Array.isArray(value.lines) || value.lines.length === 0) {
    errors.push('accountingExport.lines must contain at least one line');
  }
  value.lines?.forEach((line, index) => {
    requireNonEmpty(line.description, `accountingExport.lines.${index}.description`, errors);
    requireNonEmpty(
      line.externalReference,
      `accountingExport.lines.${index}.externalReference`,
      errors,
    );
    requireMoney(line.amountCents, `accountingExport.lines.${index}.amountCents`, errors, {
      allowNegative: true,
    });
    if (line.taxCents !== undefined) {
      requireMoney(line.taxCents, `accountingExport.lines.${index}.taxCents`, errors, {
        allowNegative: true,
      });
    }
  });
  return result(errors);
}

export function assertCanonicalValid(resultToAssert: CanonicalValidationResult): void {
  if (!resultToAssert.valid) {
    throw new ProviderValidationError({
      safeMessage: 'Canonical payload validation failed.',
      details: {
        errors: resultToAssert.errors,
      },
    });
  }
}

function baseErrors(value: {
  tenantId: string;
  source: CanonicalSourceRef;
  sourceMetadata?: SourceMetadata;
}): string[] {
  const errors: string[] = [];
  requireNonEmpty(value.tenantId, 'tenantId', errors);
  validateSource(value.source, errors);
  if (value.sourceMetadata) {
    validateSourceMetadata(value.sourceMetadata, 'sourceMetadata', errors);
  }
  return errors;
}

function validateSource(source: CanonicalSourceRef | undefined, errors: string[]): void {
  if (!source) {
    errors.push('source is required');
    return;
  }
  if (!Object.values(IntegrationProvider).includes(source.provider)) {
    errors.push('source.provider is invalid');
  }
  requireNonEmpty(source.integrationAccountId, 'source.integrationAccountId', errors);
  requireNonEmpty(source.externalId, 'source.externalId', errors);
  if (source.externalUpdatedAt) {
    requireDate(source.externalUpdatedAt, 'source.externalUpdatedAt', errors);
  }
}

function validateSourceMetadata(metadata: SourceMetadata, path: string, errors: string[]): void {
  Object.entries(metadata).forEach(([key, value]) => {
    if (UNSAFE_METADATA_KEY_PATTERN.test(key)) {
      errors.push(`${path}.${key} is not safe source metadata`);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      validateSourceMetadata(value as SourceMetadata, `${path}.${key}`, errors);
    }
  });
}

function requireNonEmpty(value: string | undefined, field: string, errors: string[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${field} is required`);
  }
}

function requireCurrency(value: string, field: string, errors: string[]): void {
  if (!CURRENCY_PATTERN.test(value)) {
    errors.push(`${field} must be a three-letter uppercase currency code`);
  }
}

function requireMoney(
  value: number,
  field: string,
  errors: string[],
  options: { allowNegative?: boolean } = {},
): void {
  if (!Number.isInteger(value)) {
    errors.push(`${field} must be integer cents`);
    return;
  }
  if (!options.allowNegative && value < 0) {
    errors.push(`${field} must be non-negative`);
  }
}

function requireDate(value: string, field: string, errors: string[]): void {
  if (Number.isNaN(Date.parse(value))) {
    errors.push(`${field} must be a valid ISO date string`);
  }
}

function requireOrderedDates(
  start: string,
  end: string,
  startField: string,
  endField: string,
  errors: string[],
): void {
  if (!Number.isNaN(Date.parse(start)) && !Number.isNaN(Date.parse(end))) {
    if (Date.parse(end) <= Date.parse(start)) {
      errors.push(`${endField} must be after ${startField}`);
    }
  }
}

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

function result(errors: string[]): CanonicalValidationResult {
  return {
    valid: errors.length === 0,
    errors,
  };
}
