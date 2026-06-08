import { Injectable } from '@nestjs/common';
import { AuditAction, IntegrationAccountStatus } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { IntegrationsRepository } from './integrations.repository';
import {
  IntegrationAccountDuplicateError,
  IntegrationSyncJobDuplicateError,
} from './integrations.errors';
import {
  CreateExternalMappingInput,
  CreateIntegrationAccountInput,
  CreateSyncJobInput,
  RecordHealthEventInput,
  UpdateIntegrationAccountStatusInput,
} from './integrations.types';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly integrationsRepository: IntegrationsRepository,
    private readonly auditService: AuditService,
  ) {}

  async createIntegrationAccount(input: CreateIntegrationAccountInput) {
    const duplicate = await this.integrationsRepository.findDuplicateIntegrationAccount(input);

    if (duplicate) {
      throw new IntegrationAccountDuplicateError();
    }

    const account = await this.integrationsRepository.createIntegrationAccount(input);

    await this.auditService.log({
      tenantId: input.tenantId,
      userId: input.connectedById ?? null,
      action: AuditAction.INTEGRATION_ACCOUNT_CREATED,
      entityType: 'IntegrationAccount',
      entityId: account.id,
      metadata: {
        provider: account.provider,
        category: account.category,
        environment: account.environment,
        status: account.status,
      },
    });

    return account;
  }

  async listIntegrationAccountsForTenant(tenantId: string) {
    return this.integrationsRepository.listIntegrationAccountsForTenant(tenantId);
  }

  async updateIntegrationAccountStatus(input: UpdateIntegrationAccountStatusInput) {
    const current = await this.integrationsRepository.findIntegrationAccountForTenant(
      input.tenantId,
      input.integrationAccountId,
    );

    const updated = await this.integrationsRepository.updateIntegrationAccountStatus(input);

    await this.auditService.log({
      tenantId: input.tenantId,
      userId: input.disconnectedById ?? null,
      action: AuditAction.INTEGRATION_ACCOUNT_STATUS_CHANGED,
      entityType: 'IntegrationAccount',
      entityId: updated.id,
      oldValues: current
        ? {
            status: current.status,
          }
        : null,
      newValues: {
        status: updated.status,
      },
      metadata: {
        provider: updated.provider,
        previousStatus: current?.status ?? null,
      },
    });

    return updated;
  }

  async createExternalMapping(input: CreateExternalMappingInput) {
    const mapping = await this.integrationsRepository.createExternalMapping(input);

    await this.auditService.log({
      tenantId: input.tenantId,
      action: AuditAction.INTEGRATION_MAPPING_CREATED,
      entityType: 'IntegrationExternalMapping',
      entityId: mapping.id,
      metadata: {
        provider: mapping.provider,
        externalType: mapping.externalType,
        internalType: mapping.internalType,
        status: mapping.status,
        matchedBy: mapping.matchedBy,
      },
    });

    return mapping;
  }

  async createSyncJob(input: CreateSyncJobInput) {
    const existing = await this.integrationsRepository.findSyncJobByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );

    if (existing) {
      return existing;
    }

    try {
      const syncJob = await this.integrationsRepository.createSyncJob(input);

      await this.auditService.log({
        tenantId: input.tenantId,
        userId: input.requestedById ?? null,
        action: AuditAction.INTEGRATION_SYNC_JOB_CREATED,
        entityType: 'IntegrationSyncJob',
        entityId: syncJob.id,
        metadata: {
          provider: syncJob.provider,
          jobType: syncJob.jobType,
          status: syncJob.status,
        },
      });

      return syncJob;
    } catch (error) {
      if (error instanceof IntegrationSyncJobDuplicateError) {
        const racedExisting = await this.integrationsRepository.findSyncJobByIdempotencyKey(
          input.tenantId,
          input.idempotencyKey,
        );

        if (racedExisting) {
          return racedExisting;
        }
      }

      throw error;
    }
  }

  async recordHealthEvent(input: RecordHealthEventInput) {
    const existing = await this.integrationsRepository.findOpenHealthEventByCorrelation(input);

    if (existing) {
      return this.integrationsRepository.updateHealthEventLastSeen(
        existing.id,
        input.tenantId,
        input,
      );
    }

    const healthEvent = await this.integrationsRepository.recordHealthEvent(input);

    await this.auditService.log({
      tenantId: input.tenantId,
      action: AuditAction.INTEGRATION_HEALTH_EVENT_RECORDED,
      entityType: 'IntegrationHealthEvent',
      entityId: healthEvent.id,
      metadata: {
        provider: healthEvent.provider,
        severity: healthEvent.severity,
        status: healthEvent.status,
        eventType: healthEvent.eventType,
        correlationId: healthEvent.correlationId,
      },
    });

    return healthEvent;
  }

  isTerminalAccountStatus(status: IntegrationAccountStatus): boolean {
    return (
      status === IntegrationAccountStatus.DISCONNECTED || status === IntegrationAccountStatus.ERROR
    );
  }
}
