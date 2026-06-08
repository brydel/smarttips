import {
  AuditAction,
  IntegrationAccountStatus,
  IntegrationCategory,
  IntegrationEnvironment,
  IntegrationHealthEventType,
  IntegrationHealthSeverity,
  IntegrationProvider,
  IntegrationSyncJobType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { IntegrationAccountDuplicateError } from './integrations.errors';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService } from './integrations.service';

const tenantId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';

type MockRepository = Record<keyof IntegrationsRepository, jest.Mock>;

type MockAuditService = {
  log: jest.Mock;
};

function createRepository(): MockRepository {
  return {
    createCredential: jest.fn(),
    createExternalMapping: jest.fn(),
    createIntegrationAccount: jest.fn(),
    createSyncJob: jest.fn(),
    findDuplicateIntegrationAccount: jest.fn(),
    findIntegrationAccountForTenant: jest.fn(),
    findOpenHealthEventByCorrelation: jest.fn(),
    findSyncJobByIdempotencyKey: jest.fn(),
    listIntegrationAccountsForTenant: jest.fn(),
    recordHealthEvent: jest.fn(),
    updateHealthEventLastSeen: jest.fn(),
    updateIntegrationAccountStatus: jest.fn(),
  } as MockRepository;
}

describe('IntegrationsService', () => {
  let repository: MockRepository;
  let auditService: MockAuditService;
  let service: IntegrationsService;

  beforeEach(() => {
    repository = createRepository();
    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    service = new IntegrationsService(
      repository as unknown as IntegrationsRepository,
      auditService as unknown as AuditService,
    );
  });

  it('creates IntegrationAccounts and writes safe audit metadata', async () => {
    repository.findDuplicateIntegrationAccount.mockResolvedValue(null);
    repository.createIntegrationAccount.mockResolvedValue({
      id: accountId,
      tenantId,
      provider: IntegrationProvider.SQUARE_POS,
      category: IntegrationCategory.DIRECT_API,
      environment: IntegrationEnvironment.SANDBOX,
      status: IntegrationAccountStatus.PENDING,
    });

    await service.createIntegrationAccount({
      tenantId,
      provider: IntegrationProvider.SQUARE_POS,
      category: IntegrationCategory.DIRECT_API,
      environment: IntegrationEnvironment.SANDBOX,
      displayName: 'Square Sandbox',
      connectedById: userId,
      settings: { mode: 'manual' },
    });

    expect(repository.createIntegrationAccount).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
    expect(auditService.log).toHaveBeenCalledWith({
      tenantId,
      userId,
      action: AuditAction.INTEGRATION_ACCOUNT_CREATED,
      entityType: 'IntegrationAccount',
      entityId: accountId,
      metadata: {
        provider: IntegrationProvider.SQUARE_POS,
        category: IntegrationCategory.DIRECT_API,
        environment: IntegrationEnvironment.SANDBOX,
        status: IntegrationAccountStatus.PENDING,
      },
    });
    expect(auditService.log.mock.calls[0][0].metadata).not.toHaveProperty('settings');
    expect(auditService.log.mock.calls[0][0].metadata).not.toHaveProperty('token');
  });

  it('blocks duplicate IntegrationAccounts before create', async () => {
    repository.findDuplicateIntegrationAccount.mockResolvedValue({ id: accountId });

    await expect(
      service.createIntegrationAccount({
        tenantId,
        provider: IntegrationProvider.SQUARE_POS,
        category: IntegrationCategory.DIRECT_API,
        environment: IntegrationEnvironment.PRODUCTION,
        displayName: 'Square',
        externalAccountId: null,
      }),
    ).rejects.toBeInstanceOf(IntegrationAccountDuplicateError);

    expect(repository.createIntegrationAccount).not.toHaveBeenCalled();
  });

  it('delegates tenant-filtered account listing to the repository', async () => {
    repository.listIntegrationAccountsForTenant.mockResolvedValue([]);

    await service.listIntegrationAccountsForTenant(tenantId);

    expect(repository.listIntegrationAccountsForTenant).toHaveBeenCalledWith(tenantId);
  });

  it('updates status through tenant-scoped repository method and audits status transition', async () => {
    repository.findIntegrationAccountForTenant.mockResolvedValue({
      id: accountId,
      tenantId,
      provider: IntegrationProvider.SQUARE_POS,
      status: IntegrationAccountStatus.CONNECTED,
    });
    repository.updateIntegrationAccountStatus.mockResolvedValue({
      id: accountId,
      tenantId,
      provider: IntegrationProvider.SQUARE_POS,
      status: IntegrationAccountStatus.PAUSED,
    });

    await service.updateIntegrationAccountStatus({
      tenantId,
      integrationAccountId: accountId,
      status: IntegrationAccountStatus.PAUSED,
    });

    expect(repository.updateIntegrationAccountStatus).toHaveBeenCalledWith({
      tenantId,
      integrationAccountId: accountId,
      status: IntegrationAccountStatus.PAUSED,
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        action: AuditAction.INTEGRATION_ACCOUNT_STATUS_CHANGED,
        oldValues: { status: IntegrationAccountStatus.CONNECTED },
        newValues: { status: IntegrationAccountStatus.PAUSED },
      }),
    );
  });

  it('creates sync jobs idempotently per tenant', async () => {
    repository.findSyncJobByIdempotencyKey.mockResolvedValue({ id: 'existing-job', tenantId });

    const result = await service.createSyncJob({
      tenantId,
      provider: IntegrationProvider.UNIVERSAL_POS_IMPORT,
      jobType: IntegrationSyncJobType.IMPORT_APPLY,
      idempotencyKey: 'tenant-sync-key',
    });

    expect(result).toEqual({ id: 'existing-job', tenantId });
    expect(repository.createSyncJob).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('creates and audits new sync jobs when idempotency key is unused', async () => {
    repository.findSyncJobByIdempotencyKey.mockResolvedValue(null);
    repository.createSyncJob.mockResolvedValue({
      id: 'sync-job-id',
      tenantId,
      provider: IntegrationProvider.UNIVERSAL_POS_IMPORT,
      jobType: IntegrationSyncJobType.IMPORT_APPLY,
      status: 'QUEUED',
    });

    await service.createSyncJob({
      tenantId,
      provider: IntegrationProvider.UNIVERSAL_POS_IMPORT,
      jobType: IntegrationSyncJobType.IMPORT_APPLY,
      idempotencyKey: 'tenant-sync-key',
      requestedById: userId,
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: AuditAction.INTEGRATION_SYNC_JOB_CREATED,
        entityType: 'IntegrationSyncJob',
      }),
    );
  });

  it('records new health events and audits only safe metadata', async () => {
    repository.findOpenHealthEventByCorrelation.mockResolvedValue(null);
    repository.recordHealthEvent.mockResolvedValue({
      id: 'health-id',
      tenantId,
      provider: IntegrationProvider.SQUARE_POS,
      severity: IntegrationHealthSeverity.ERROR,
      status: 'OPEN',
      eventType: IntegrationHealthEventType.PROVIDER_DEGRADED,
      correlationId: 'square-outage',
    });

    await service.recordHealthEvent({
      tenantId,
      provider: IntegrationProvider.SQUARE_POS,
      severity: IntegrationHealthSeverity.ERROR,
      eventType: IntegrationHealthEventType.PROVIDER_DEGRADED,
      messageKey: 'integrations.square.degraded',
      safeDetails: { reason: 'timeout' },
      correlationId: 'square-outage',
    });

    expect(repository.recordHealthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, safeDetails: { reason: 'timeout' } }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        action: AuditAction.INTEGRATION_HEALTH_EVENT_RECORDED,
        metadata: expect.objectContaining({ correlationId: 'square-outage' }),
      }),
    );
    expect(auditService.log.mock.calls[0][0].metadata).not.toHaveProperty('safeDetails');
  });

  it('dedupes correlated health events in service logic', async () => {
    repository.findOpenHealthEventByCorrelation.mockResolvedValue({ id: 'existing-health' });
    repository.updateHealthEventLastSeen.mockResolvedValue({ id: 'existing-health' });

    await service.recordHealthEvent({
      tenantId,
      provider: IntegrationProvider.SQUARE_POS,
      severity: IntegrationHealthSeverity.WARNING,
      eventType: IntegrationHealthEventType.RATE_LIMITED,
      messageKey: 'integrations.square.rateLimited',
      correlationId: 'rate-limit-window',
    });

    expect(repository.updateHealthEventLastSeen).toHaveBeenCalledWith(
      'existing-health',
      tenantId,
      expect.objectContaining({ correlationId: 'rate-limit-window' }),
    );
    expect(repository.recordHealthEvent).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('identifies terminal account statuses without provider logic', () => {
    expect(service.isTerminalAccountStatus(IntegrationAccountStatus.DISCONNECTED)).toBe(true);
    expect(service.isTerminalAccountStatus(IntegrationAccountStatus.ERROR)).toBe(true);
    expect(service.isTerminalAccountStatus(IntegrationAccountStatus.CONNECTED)).toBe(false);
  });
});
