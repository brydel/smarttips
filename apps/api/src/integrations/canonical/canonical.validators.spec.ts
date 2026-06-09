import { IntegrationProvider } from '@prisma/client';

import {
  CanonicalEmployee,
  CanonicalOrder,
  CanonicalSale,
  CanonicalShift,
  CanonicalTimeEntry,
  CanonicalTip,
} from './canonical.types';
import {
  assertCanonicalValid,
  validateCanonicalEmployee,
  validateCanonicalOrder,
  validateCanonicalSale,
  validateCanonicalShift,
  validateCanonicalTimeEntry,
  validateCanonicalTip,
} from './canonical.validators';
import { ProviderValidationError } from '../errors/connector.errors';

const base = {
  tenantId: 'tenant-1',
  source: {
    provider: IntegrationProvider.SQUARE_POS,
    integrationAccountId: 'account-1',
    externalId: 'external-1',
  },
};

describe('canonical validators', () => {
  it('accepts a valid employee canonical DTO', () => {
    const employee: CanonicalEmployee = {
      ...base,
      displayName: 'Jane Server',
      sourceMetadata: {
        safeVendorName: 'square',
      },
    };

    expect(validateCanonicalEmployee(employee)).toEqual({ valid: true, errors: [] });
  });

  it('rejects missing tenantId and source externalId', () => {
    const employee: CanonicalEmployee = {
      ...base,
      tenantId: '',
      source: {
        ...base.source,
        externalId: '',
      },
      displayName: 'Jane Server',
    };

    const result = validateCanonicalEmployee(employee);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('tenantId is required');
    expect(result.errors).toContain('source.externalId is required');
  });

  it('rejects invalid provider values', () => {
    const employee = {
      ...base,
      source: {
        ...base.source,
        provider: 'NOT_A_PROVIDER',
      },
      displayName: 'Jane Server',
    } as unknown as CanonicalEmployee;

    expect(validateCanonicalEmployee(employee).errors).toContain('source.provider is invalid');
  });

  it('rejects empty employee displayName', () => {
    const employee: CanonicalEmployee = {
      ...base,
      displayName: '   ',
    };

    expect(validateCanonicalEmployee(employee).errors).toContain(
      'employee.displayName is required',
    );
  });

  it('validates integer cents and rejects negative tips unless explicitly allowed', () => {
    const tip: CanonicalTip = {
      ...base,
      locationExternalId: 'loc-1',
      tipCents: -1,
      currency: 'CAD',
      receivedAt: '2026-06-08T12:00:00.000Z',
    };

    expect(validateCanonicalTip(tip).errors).toContain('tip.tipCents must be non-negative');
    expect(validateCanonicalTip({ ...tip, allowNegative: true })).toEqual({
      valid: true,
      errors: [],
    });
    expect(validateCanonicalTip({ ...tip, tipCents: 10.5 }).errors).toContain(
      'tip.tipCents must be integer cents',
    );
  });

  it('rejects invalid currency strings', () => {
    const sale: CanonicalSale = {
      ...base,
      locationExternalId: 'loc-1',
      orderExternalId: 'order-1',
      closedAt: '2026-06-08T12:00:00.000Z',
      subtotalCents: 1000,
      taxCents: 150,
      totalCents: 1150,
      currency: 'cad',
    };

    expect(validateCanonicalSale(sale).errors).toContain(
      'sale.currency must be a three-letter uppercase currency code',
    );
  });

  it('rejects invalid shift and time-entry date ordering', () => {
    const shift: CanonicalShift = {
      ...base,
      locationExternalId: 'loc-1',
      localDate: '2026-06-08',
      startAt: '2026-06-08T16:00:00.000Z',
      endAt: '2026-06-08T15:00:00.000Z',
      status: 'CLOSED',
    };
    const timeEntry: CanonicalTimeEntry = {
      ...base,
      employeeExternalId: 'emp-1',
      locationExternalId: 'loc-1',
      clockInAt: '2026-06-08T16:00:00.000Z',
      clockOutAt: '2026-06-08T15:00:00.000Z',
      status: 'CLOSED',
    };

    expect(validateCanonicalShift(shift).errors).toContain(
      'shift.endAt must be after shift.startAt',
    );
    expect(validateCanonicalTimeEntry(timeEntry).errors).toContain(
      'timeEntry.clockOutAt must be after timeEntry.clockInAt',
    );
  });

  it('rejects simple sale and order total inconsistencies', () => {
    const sale: CanonicalSale = {
      ...base,
      locationExternalId: 'loc-1',
      orderExternalId: 'order-1',
      closedAt: '2026-06-08T12:00:00.000Z',
      subtotalCents: 1000,
      taxCents: 150,
      totalCents: 1000,
      currency: 'CAD',
    };
    const order: CanonicalOrder = {
      ...base,
      locationExternalId: 'loc-1',
      orderNumber: '100',
      openedAt: '2026-06-08T12:00:00.000Z',
      status: 'PAID',
      subtotalCents: 1000,
      taxCents: 150,
      tipCents: 200,
      totalCents: 1200,
      currency: 'CAD',
    };

    expect(validateCanonicalSale(sale).errors).toContain(
      'sale.totalCents must be greater than or equal to subtotalCents + taxCents',
    );
    expect(validateCanonicalOrder(order).errors).toContain(
      'order.totalCents must reconcile with subtotalCents + taxCents + tipCents',
    );
  });

  it('rejects unsafe raw provider metadata keys', () => {
    const employee: CanonicalEmployee = {
      ...base,
      displayName: 'Jane Server',
      sourceMetadata: {
        rawPayload: { id: 'secret' },
      },
    };

    expect(validateCanonicalEmployee(employee).errors).toContain(
      'sourceMetadata.rawPayload is not safe source metadata',
    );
  });

  it('throws a typed validation error from assertCanonicalValid', () => {
    expect(() => assertCanonicalValid({ valid: false, errors: ['bad'] })).toThrow(
      ProviderValidationError,
    );
  });
});
