import {
  IntegrationAccountStatus,
  IntegrationCategory,
  IntegrationCredentialKind,
  IntegrationEnvironment,
  IntegrationExternalType,
  IntegrationHealthEventType,
  IntegrationHealthSeverity,
  IntegrationInternalType,
  IntegrationMappingMatchedBy,
  IntegrationProvider,
  IntegrationSyncJobType,
  Prisma,
} from '@prisma/client';

import {
  IntegrationAccountNotFoundError,
  IntegrationCredentialDuplicateError,
  IntegrationMappingDuplicateError,
  IntegrationTenantRequiredError,
} from './integrations.errors';
import { IntegrationsRepository } from './integrations.repository';

type MockPrismaModel = Record<string, jest.Mock>;

type MockPrisma = {
  integrationAccount: MockPrismaModel;
  integrationCredential: MockPrismaModel;
  integrationExternalMapping: MockPrismaModel;
  integrationSyncJob: MockPrismaModel;
  integrationHealthEvent: MockPrismaModel;
};

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const accountId = '33333333-3333-4333-8333-333333333333';
const internalId = '44444444-4444-4444-8444-444444444444';

function createMockPrisma(): MockPrisma {
  return {
    integrationAccount: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    integrationCredential: {
      create: jest.fn(),
    },
    integrationExternalMapping: {
      create: jest.fn(),
    },
    integrationSyncJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    integrationHealthEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

function uniqueError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('IntegrationsRepository', () => {
  let prisma: MockPrisma;
  let repository: IntegrationsRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repository = new IntegrationsRepository(prisma as never);
  });

  it('requires tenantId for repository methods', async () => {
    await expect(repository.listIntegrationAccountsForTenant('')).rejects.toBeInstanceOf(
      IntegrationTenantRequiredError,
    );
  });

  it('creates an IntegrationAccount with tenant-scoped data and no credential fields', async () => {
    prisma.integrationAccount.create.mockResolvedValue({ id: accountId });

    await repository.createIntegrationAccount({
      tenantId: tenantA,
      provider: IntegrationProvider.SQUARE_POS,
      category: IntegrationCategory.DIRECT_API,
      environment: IntegrationEnvironment.SANDBOX,
      displayName: 'Square sandbox',
      externalAccountId: null,
      capabilities: ['LOCATIONS'],
      settings: { sync: 'manual' },
    });

    expect(prisma.integrationAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: tenantA,
        provider: IntegrationProvider.SQUARE_POS,
        category: IntegrationCategory.DIRECT_API,
        environment: IntegrationEnvironment.SANDBOX,
        externalAccountId: null,
        capabilities: ['LOCATIONS'],
        settings: { sync: 'manual' },
      }),
    });
    expect(prisma.integrationAccount.create.mock.calls[0][0].data).not.toHaveProperty('token');
    expect(prisma.integrationAccount.create.mock.calls[0][0].data).not.toHaveProperty('apiKey');
  });

  it('lists IntegrationAccounts only for the requested tenant', async () => {
    prisma.integrationAccount.findMany.mockResolvedValue([]);

    await repository.listIntegrationAccountsForTenant(tenantA);

    expect(prisma.integrationAccount.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: tenantA,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('detects duplicate null externalAccountId accounts in service-compatible lookup', async () => {
    prisma.integrationAccount.findFirst.mockResolvedValue({ id: accountId });

    await repository.findDuplicateIntegrationAccount({
      tenantId: tenantA,
      provider: IntegrationProvider.SQUARE_POS,
      category: IntegrationCategory.DIRECT_API,
      environment: IntegrationEnvironment.PRODUCTION,
      displayName: 'Square',
      externalAccountId: null,
    });

    expect(prisma.integrationAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: tenantA,
        provider: IntegrationProvider.SQUARE_POS,
        environment: IntegrationEnvironment.PRODUCTION,
        externalAccountId: null,
        deletedAt: null,
      },
    });
  });

  it('scopes status updates by tenant and fails cross-tenant mutation', async () => {
    prisma.integrationAccount.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.updateIntegrationAccountStatus({
        tenantId: tenantB,
        integrationAccountId: accountId,
        status: IntegrationAccountStatus.PAUSED,
      }),
    ).rejects.toBeInstanceOf(IntegrationAccountNotFoundError);

    expect(prisma.integrationAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: accountId,
        tenantId: tenantB,
        deletedAt: null,
      },
      data: expect.objectContaining({
        status: IntegrationAccountStatus.PAUSED,
      }),
    });
  });

  it('stores only encrypted credential payload data', async () => {
    prisma.integrationAccount.findFirst.mockResolvedValue({ id: accountId, tenantId: tenantA });
    prisma.integrationCredential.create.mockResolvedValue({ id: 'credential-id' });

    await repository.createCredential({
      tenantId: tenantA,
      integrationAccountId: accountId,
      kind: IntegrationCredentialKind.OAUTH_ACCESS_TOKEN,
      encryptedPayload: 'ciphertext.not-plaintext',
      encryptionKeyVersion: 'k1',
      scopes: ['ORDERS_READ'],
    });

    expect(prisma.integrationCredential.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: tenantA,
        integrationAccountId: accountId,
        kind: IntegrationCredentialKind.OAUTH_ACCESS_TOKEN,
        encryptedPayload: 'ciphertext.not-plaintext',
        encryptionKeyVersion: 'k1',
        scopes: ['ORDERS_READ'],
      }),
    });
    expect(prisma.integrationCredential.create.mock.calls[0][0].data.encryptedPayload).not.toBe(
      'plain-token',
    );
  });

  it('maps credential unique constraint errors to domain errors', async () => {
    prisma.integrationAccount.findFirst.mockResolvedValue({ id: accountId, tenantId: tenantA });
    prisma.integrationCredential.create.mockRejectedValue(uniqueError());

    await expect(
      repository.createCredential({
        tenantId: tenantA,
        integrationAccountId: accountId,
        kind: IntegrationCredentialKind.OAUTH_ACCESS_TOKEN,
        encryptedPayload: 'ciphertext',
        encryptionKeyVersion: 'k1',
      }),
    ).rejects.toBeInstanceOf(IntegrationCredentialDuplicateError);
  });

  it('creates external mappings with tenant-scoped unique identity', async () => {
    prisma.integrationAccount.findFirst.mockResolvedValue({ id: accountId, tenantId: tenantA });
    prisma.integrationExternalMapping.create.mockResolvedValue({ id: 'mapping-id' });

    await repository.createExternalMapping({
      tenantId: tenantA,
      integrationAccountId: accountId,
      provider: IntegrationProvider.SQUARE_POS,
      externalType: IntegrationExternalType.EMPLOYEE,
      externalId: 'emp_123',
      internalType: IntegrationInternalType.EMPLOYEE,
      internalId,
      matchedBy: IntegrationMappingMatchedBy.MANUAL,
    });

    expect(prisma.integrationExternalMapping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: tenantA,
        integrationAccountId: accountId,
        externalType: IntegrationExternalType.EMPLOYEE,
        externalId: 'emp_123',
        internalType: IntegrationInternalType.EMPLOYEE,
        internalId,
      }),
    });
  });

  it('allows external IDs to repeat across tenants through tenant-scoped create data', async () => {
    prisma.integrationAccount.findFirst.mockResolvedValue({ id: accountId, tenantId: tenantB });
    prisma.integrationExternalMapping.create.mockResolvedValue({ id: 'mapping-id' });

    await repository.createExternalMapping({
      tenantId: tenantB,
      integrationAccountId: accountId,
      provider: IntegrationProvider.SQUARE_POS,
      externalType: IntegrationExternalType.EMPLOYEE,
      externalId: 'emp_123',
      internalType: IntegrationInternalType.EMPLOYEE,
      internalId,
      matchedBy: IntegrationMappingMatchedBy.MANUAL,
    });

    expect(prisma.integrationExternalMapping.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        tenantId: tenantB,
        externalId: 'emp_123',
      }),
    );
  });

  it('maps external mapping unique constraint errors to domain errors', async () => {
    prisma.integrationAccount.findFirst.mockResolvedValue({ id: accountId, tenantId: tenantA });
    prisma.integrationExternalMapping.create.mockRejectedValue(uniqueError());

    await expect(
      repository.createExternalMapping({
        tenantId: tenantA,
        integrationAccountId: accountId,
        provider: IntegrationProvider.SQUARE_POS,
        externalType: IntegrationExternalType.EMPLOYEE,
        externalId: 'emp_123',
        internalType: IntegrationInternalType.EMPLOYEE,
        internalId,
        matchedBy: IntegrationMappingMatchedBy.AUTO,
      }),
    ).rejects.toBeInstanceOf(IntegrationMappingDuplicateError);
  });

  it('looks up sync jobs by tenant-scoped idempotency key', async () => {
    prisma.integrationSyncJob.findUnique.mockResolvedValue(null);

    await repository.findSyncJobByIdempotencyKey(tenantA, 'sync-key');

    expect(prisma.integrationSyncJob.findUnique).toHaveBeenCalledWith({
      where: {
        unique_sync_job_idempotency_per_tenant: {
          tenantId: tenantA,
          idempotencyKey: 'sync-key',
        },
      },
    });
  });

  it('creates sync jobs with tenant-scoped idempotency keys', async () => {
    prisma.integrationSyncJob.create.mockResolvedValue({ id: 'sync-job-id' });

    await repository.createSyncJob({
      tenantId: tenantA,
      provider: IntegrationProvider.UNIVERSAL_POS_IMPORT,
      jobType: IntegrationSyncJobType.IMPORT_APPLY,
      idempotencyKey: 'apply-batch-1',
    });

    expect(prisma.integrationSyncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: tenantA,
        provider: IntegrationProvider.UNIVERSAL_POS_IMPORT,
        jobType: IntegrationSyncJobType.IMPORT_APPLY,
        idempotencyKey: 'apply-batch-1',
      }),
    });
  });

  it('records health events with safeDetails only', async () => {
    prisma.integrationHealthEvent.create.mockResolvedValue({ id: 'health-id' });

    await repository.recordHealthEvent({
      tenantId: tenantA,
      provider: IntegrationProvider.SQUARE_POS,
      severity: IntegrationHealthSeverity.WARNING,
      eventType: IntegrationHealthEventType.PROVIDER_DEGRADED,
      messageKey: 'integrations.square.degraded',
      safeDetails: { code: 'rate_limited' },
    });

    expect(prisma.integrationHealthEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: tenantA,
        provider: IntegrationProvider.SQUARE_POS,
        severity: IntegrationHealthSeverity.WARNING,
        safeDetails: { code: 'rate_limited' },
      }),
    });
    expect(
      prisma.integrationHealthEvent.create.mock.calls[0][0].data.safeDetails,
    ).not.toHaveProperty('token');
  });
});
