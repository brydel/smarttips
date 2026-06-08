import { Injectable } from '@nestjs/common';
import { IntegrationAccountStatus, IntegrationHealthStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  IntegrationAccountNotFoundError,
  IntegrationCredentialDuplicateError,
  IntegrationMappingDuplicateError,
  IntegrationSyncJobDuplicateError,
  IntegrationTenantRequiredError,
} from './integrations.errors';
import {
  CreateExternalMappingInput,
  CreateIntegrationAccountInput,
  CreateIntegrationCredentialInput,
  CreateSyncJobInput,
  RecordHealthEventInput,
  UpdateIntegrationAccountStatusInput,
} from './integrations.types';

@Injectable()
export class IntegrationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createIntegrationAccount(input: CreateIntegrationAccountInput) {
    this.assertTenantId(input.tenantId);

    return this.prisma.integrationAccount.create({
      data: {
        tenantId: input.tenantId,
        provider: input.provider,
        category: input.category,
        environment: input.environment,
        displayName: input.displayName,
        externalAccountId: input.externalAccountId ?? null,
        externalMerchantId: input.externalMerchantId ?? null,
        status: input.status ?? IntegrationAccountStatus.PENDING,
        capabilities: input.capabilities ?? [],
        settings: input.settings ?? {},
        connectedById: input.connectedById ?? null,
        connectedAt: input.connectedAt ?? null,
      },
    });
  }

  async findDuplicateIntegrationAccount(input: CreateIntegrationAccountInput) {
    this.assertTenantId(input.tenantId);

    return this.prisma.integrationAccount.findFirst({
      where: {
        tenantId: input.tenantId,
        provider: input.provider,
        environment: input.environment,
        externalAccountId: input.externalAccountId ?? null,
        deletedAt: null,
      },
    });
  }

  async listIntegrationAccountsForTenant(tenantId: string) {
    this.assertTenantId(tenantId);

    return this.prisma.integrationAccount.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findIntegrationAccountForTenant(tenantId: string, integrationAccountId: string) {
    this.assertTenantId(tenantId);

    return this.prisma.integrationAccount.findFirst({
      where: {
        id: integrationAccountId,
        tenantId,
        deletedAt: null,
      },
    });
  }

  async updateIntegrationAccountStatus(input: UpdateIntegrationAccountStatusInput) {
    this.assertTenantId(input.tenantId);

    const result = await this.prisma.integrationAccount.updateMany({
      where: {
        id: input.integrationAccountId,
        tenantId: input.tenantId,
        deletedAt: null,
      },
      data: {
        status: input.status,
        disconnectedById: input.disconnectedById ?? undefined,
        disconnectedAt: input.disconnectedAt ?? undefined,
        lastSyncAt: input.lastSyncAt ?? undefined,
      },
    });

    if (result.count !== 1) {
      throw new IntegrationAccountNotFoundError();
    }

    const updated = await this.findIntegrationAccountForTenant(
      input.tenantId,
      input.integrationAccountId,
    );

    if (!updated) {
      throw new IntegrationAccountNotFoundError();
    }

    return updated;
  }

  async createCredential(input: CreateIntegrationCredentialInput) {
    this.assertTenantId(input.tenantId);
    await this.assertIntegrationAccountBelongsToTenant(input.tenantId, input.integrationAccountId);

    try {
      return await this.prisma.integrationCredential.create({
        data: {
          tenantId: input.tenantId,
          integrationAccountId: input.integrationAccountId,
          kind: input.kind,
          status: input.status,
          encryptedPayload: input.encryptedPayload,
          encryptionKeyVersion: input.encryptionKeyVersion,
          scopes: input.scopes ?? [],
          expiresAt: input.expiresAt ?? null,
          lastRefreshedAt: input.lastRefreshedAt ?? null,
          rotatedAt: input.rotatedAt ?? null,
          revokedAt: input.revokedAt ?? null,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new IntegrationCredentialDuplicateError();
      }
      throw error;
    }
  }

  async createExternalMapping(input: CreateExternalMappingInput) {
    this.assertTenantId(input.tenantId);
    await this.assertIntegrationAccountBelongsToTenant(input.tenantId, input.integrationAccountId);

    try {
      return await this.prisma.integrationExternalMapping.create({
        data: {
          tenantId: input.tenantId,
          integrationAccountId: input.integrationAccountId,
          provider: input.provider,
          externalType: input.externalType,
          externalId: input.externalId,
          internalType: input.internalType,
          internalId: input.internalId,
          displayName: input.displayName ?? null,
          status: input.status,
          matchedBy: input.matchedBy,
          confidence: input.confidence,
          canonicalHash: input.canonicalHash ?? null,
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new IntegrationMappingDuplicateError();
      }
      throw error;
    }
  }

  async findSyncJobByIdempotencyKey(tenantId: string, idempotencyKey: string) {
    this.assertTenantId(tenantId);

    return this.prisma.integrationSyncJob.findUnique({
      where: {
        unique_sync_job_idempotency_per_tenant: {
          tenantId,
          idempotencyKey,
        },
      },
    });
  }

  async createSyncJob(input: CreateSyncJobInput) {
    this.assertTenantId(input.tenantId);

    if (input.integrationAccountId) {
      await this.assertIntegrationAccountBelongsToTenant(
        input.tenantId,
        input.integrationAccountId,
      );
    }

    try {
      return await this.prisma.integrationSyncJob.create({
        data: {
          tenantId: input.tenantId,
          integrationAccountId: input.integrationAccountId ?? null,
          provider: input.provider,
          jobType: input.jobType,
          status: input.status,
          idempotencyKey: input.idempotencyKey,
          cursorFrom: input.cursorFrom ?? Prisma.JsonNull,
          cursorTo: input.cursorTo ?? Prisma.JsonNull,
          requestedById: input.requestedById ?? null,
          startedAt: input.startedAt ?? null,
          finishedAt: input.finishedAt ?? null,
          nextRetryAt: input.nextRetryAt ?? null,
          attemptCount: input.attemptCount,
          maxAttempts: input.maxAttempts,
          errorCode: input.errorCode ?? null,
          safeErrorMessage: input.safeErrorMessage ?? null,
          stats: input.stats ?? {},
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new IntegrationSyncJobDuplicateError();
      }
      throw error;
    }
  }

  async findOpenHealthEventByCorrelation(input: RecordHealthEventInput) {
    this.assertTenantId(input.tenantId);

    if (!input.correlationId) {
      return null;
    }

    return this.prisma.integrationHealthEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        integrationAccountId: input.integrationAccountId ?? null,
        eventType: input.eventType,
        correlationId: input.correlationId,
        status: {
          not: IntegrationHealthStatus.RESOLVED,
        },
      },
    });
  }

  async updateHealthEventLastSeen(id: string, tenantId: string, input: RecordHealthEventInput) {
    this.assertTenantId(tenantId);

    const result = await this.prisma.integrationHealthEvent.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        severity: input.severity,
        status: input.status,
        messageKey: input.messageKey,
        safeDetails: input.safeDetails ?? {},
        lastSeenAt: input.lastSeenAt ?? new Date(),
        resolvedAt: input.resolvedAt ?? undefined,
      },
    });

    if (result.count !== 1) {
      throw new IntegrationAccountNotFoundError();
    }

    return this.prisma.integrationHealthEvent.findFirstOrThrow({
      where: {
        id,
        tenantId,
      },
    });
  }

  async recordHealthEvent(input: RecordHealthEventInput) {
    this.assertTenantId(input.tenantId);

    if (input.integrationAccountId) {
      await this.assertIntegrationAccountBelongsToTenant(
        input.tenantId,
        input.integrationAccountId,
      );
    }

    const now = new Date();

    return this.prisma.integrationHealthEvent.create({
      data: {
        tenantId: input.tenantId,
        integrationAccountId: input.integrationAccountId ?? null,
        provider: input.provider,
        severity: input.severity,
        status: input.status,
        eventType: input.eventType,
        messageKey: input.messageKey,
        safeDetails: input.safeDetails ?? {},
        correlationId: input.correlationId ?? null,
        firstSeenAt: input.firstSeenAt ?? now,
        lastSeenAt: input.lastSeenAt ?? now,
        resolvedAt: input.resolvedAt ?? null,
      },
    });
  }

  private async assertIntegrationAccountBelongsToTenant(
    tenantId: string,
    integrationAccountId: string,
  ): Promise<void> {
    const account = await this.findIntegrationAccountForTenant(tenantId, integrationAccountId);

    if (!account) {
      throw new IntegrationAccountNotFoundError();
    }
  }

  private assertTenantId(tenantId: string): void {
    if (tenantId.trim().length === 0) {
      throw new IntegrationTenantRequiredError();
    }
  }

  private isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
