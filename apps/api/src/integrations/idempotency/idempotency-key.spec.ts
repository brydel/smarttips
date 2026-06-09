import { IntegrationProvider, IntegrationSyncJobType } from '@prisma/client';

import {
  buildCanonicalEntityIdempotencyKey,
  buildProviderWindowIdempotencyKey,
  buildSyncJobIdempotencyKey,
  stableStringify,
} from './idempotency-key';

describe('idempotency key helpers', () => {
  it('uses stable JSON encoding independent of object key order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });

  it('builds deterministic sync job keys', () => {
    const input = {
      tenantId: 'tenant-1',
      provider: IntegrationProvider.SQUARE_POS,
      integrationAccountId: 'account-1',
      jobType: IntegrationSyncJobType.INCREMENTAL_SYNC,
      window: { to: '2026-06-09T00:00:00.000Z', from: '2026-06-08T00:00:00.000Z' },
    };

    expect(buildSyncJobIdempotencyKey(input)).toBe(buildSyncJobIdempotencyKey(input));
    expect(buildSyncJobIdempotencyKey(input)).toMatch(/^sync-job:[a-f0-9]{64}$/);
  });

  it('changes sync keys when tenant, provider, account, or window changes', () => {
    const base = {
      tenantId: 'tenant-1',
      provider: IntegrationProvider.SQUARE_POS,
      integrationAccountId: 'account-1',
      jobType: IntegrationSyncJobType.INCREMENTAL_SYNC,
      window: { from: '2026-06-08T00:00:00.000Z', to: '2026-06-09T00:00:00.000Z' },
    };

    const original = buildSyncJobIdempotencyKey(base);

    expect(buildSyncJobIdempotencyKey({ ...base, tenantId: 'tenant-2' })).not.toBe(original);
    expect(
      buildSyncJobIdempotencyKey({ ...base, provider: IntegrationProvider.CLOVER_POS }),
    ).not.toBe(original);
    expect(buildSyncJobIdempotencyKey({ ...base, integrationAccountId: 'account-2' })).not.toBe(
      original,
    );
    expect(
      buildSyncJobIdempotencyKey({
        ...base,
        window: { ...base.window, to: '2026-06-10T00:00:00.000Z' },
      }),
    ).not.toBe(original);
  });

  it('builds scoped canonical entity and provider window keys', () => {
    expect(
      buildCanonicalEntityIdempotencyKey({
        tenantId: 'tenant-1',
        provider: IntegrationProvider.SQUARE_POS,
        integrationAccountId: 'account-1',
        entityType: 'ORDER',
        externalId: 'order-1',
        version: 'v1',
      }),
    ).toMatch(/^canonical-entity:[a-f0-9]{64}$/);

    expect(
      buildProviderWindowIdempotencyKey({
        tenantId: 'tenant-1',
        provider: IntegrationProvider.SQUARE_POS,
        integrationAccountId: 'account-1',
        from: '2026-06-08T00:00:00.000Z',
        to: '2026-06-09T00:00:00.000Z',
      }),
    ).toMatch(/^provider-window:[a-f0-9]{64}$/);
  });
});
