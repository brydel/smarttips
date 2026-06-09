import {
  IntegrationCategory,
  IntegrationCredentialStatus,
  IntegrationProvider,
} from '@prisma/client';

import { UnsupportedCapabilityError } from '../errors/connector.errors';
import { ConnectorRegistry } from './connector-registry';
import { SmartTipsConnector } from './smarttips-connector.interface';

function fakeConnector(
  provider = IntegrationProvider.SQUARE_POS,
  capabilities: SmartTipsConnector['capabilities'] = ['LOCATIONS', 'EMPLOYEES'],
): SmartTipsConnector {
  return {
    provider,
    category: IntegrationCategory.DIRECT_API,
    capabilities,
    validateConfig: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
    connect: jest
      .fn()
      .mockResolvedValue({ provider, integrationAccountId: 'account-1', connected: true }),
    refreshCredentials: jest.fn().mockResolvedValue({
      status: IntegrationCredentialStatus.ACTIVE,
      refreshedAt: '2026-06-08T12:00:00.000Z',
    }),
    disconnect: jest.fn().mockResolvedValue({
      disconnected: true,
      disconnectedAt: '2026-06-08T12:00:00.000Z',
    }),
    listLocations: jest
      .fn()
      .mockResolvedValue({
        items: [],
        hasMore: false,
        stats: { fetched: 0, accepted: 0, rejected: 0 },
      }),
    listEmployees: jest
      .fn()
      .mockResolvedValue({
        items: [],
        hasMore: false,
        stats: { fetched: 0, accepted: 0, rejected: 0 },
      }),
    syncSales: jest
      .fn()
      .mockResolvedValue({
        items: [],
        hasMore: false,
        stats: { fetched: 0, accepted: 0, rejected: 0 },
      }),
    syncTips: jest
      .fn()
      .mockResolvedValue({
        items: [],
        hasMore: false,
        stats: { fetched: 0, accepted: 0, rejected: 0 },
      }),
    syncTimeEntries: jest
      .fn()
      .mockResolvedValue({
        items: [],
        hasMore: false,
        stats: { fetched: 0, accepted: 0, rejected: 0 },
      }),
    healthCheck: jest
      .fn()
      .mockResolvedValue({
        provider,
        integrationAccountId: 'account-1',
        healthy: true,
        checkedAt: '2026-06-08T12:00:00.000Z',
      }),
  };
}

describe('ConnectorRegistry', () => {
  it('registers and retrieves connectors by provider', () => {
    const registry = new ConnectorRegistry();
    const connector = fakeConnector();

    registry.register(connector);

    expect(registry.get(IntegrationProvider.SQUARE_POS)).toBe(connector);
    expect(registry.availableProviders()).toEqual([IntegrationProvider.SQUARE_POS]);
    expect(registry.availableCapabilities(IntegrationProvider.SQUARE_POS)).toEqual([
      'LOCATIONS',
      'EMPLOYEES',
    ]);
  });

  it('rejects duplicate provider registration', () => {
    const registry = new ConnectorRegistry();
    registry.register(fakeConnector());

    expect(() => registry.register(fakeConnector())).toThrow(UnsupportedCapabilityError);
  });

  it('throws typed unsupported errors for missing connectors and capabilities', () => {
    const registry = new ConnectorRegistry();

    expect(() => registry.get(IntegrationProvider.CLOVER_POS)).toThrow(UnsupportedCapabilityError);

    registry.register(fakeConnector(IntegrationProvider.SQUARE_POS, ['LOCATIONS']));

    expect(() => registry.getForCapability(IntegrationProvider.SQUARE_POS, 'TIPS')).toThrow(
      UnsupportedCapabilityError,
    );
  });

  it('allows a fake connector to satisfy the provider-neutral interface', async () => {
    const connector = fakeConnector();
    const result = await connector.healthCheck({
      tenantId: 'tenant-1',
      integrationAccountId: 'account-1',
    });

    expect(result.healthy).toBe(true);
    expect(connector.capabilities).toContain('LOCATIONS');
  });
});
