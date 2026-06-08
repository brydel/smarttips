import {
  IntegrationAccountStatus,
  IntegrationCategory,
  IntegrationCredentialKind,
  IntegrationCredentialStatus,
  IntegrationEnvironment,
  IntegrationExternalType,
  IntegrationHealthEventType,
  IntegrationHealthSeverity,
  IntegrationHealthStatus,
  IntegrationInternalType,
  IntegrationMappingMatchedBy,
  IntegrationMappingStatus,
  IntegrationProvider,
  IntegrationSyncJobStatus,
  IntegrationSyncJobType,
  Prisma,
} from '@prisma/client';

export type JsonInput = Prisma.InputJsonValue;

export type EncryptedCredentialPayload = {
  ciphertext: string;
  encryptionKeyVersion: string;
  algorithm?: string;
  iv?: string;
  tag?: string;
};

export interface IntegrationCredentialEncryptionPort {
  encrypt(plaintext: string): Promise<EncryptedCredentialPayload>;
  decrypt(payload: EncryptedCredentialPayload): Promise<string>;
}

export type CreateIntegrationAccountInput = {
  tenantId: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  environment: IntegrationEnvironment;
  displayName: string;
  externalAccountId?: string | null;
  externalMerchantId?: string | null;
  status?: IntegrationAccountStatus;
  capabilities?: JsonInput;
  settings?: JsonInput;
  connectedById?: string | null;
  connectedAt?: Date | null;
};

export type UpdateIntegrationAccountStatusInput = {
  tenantId: string;
  integrationAccountId: string;
  status: IntegrationAccountStatus;
  disconnectedById?: string | null;
  disconnectedAt?: Date | null;
  lastSyncAt?: Date | null;
};

export type CreateIntegrationCredentialInput = {
  tenantId: string;
  integrationAccountId: string;
  kind: IntegrationCredentialKind;
  status?: IntegrationCredentialStatus;
  encryptedPayload: string;
  encryptionKeyVersion: string;
  scopes?: JsonInput;
  expiresAt?: Date | null;
  lastRefreshedAt?: Date | null;
  rotatedAt?: Date | null;
  revokedAt?: Date | null;
};

export type CreateExternalMappingInput = {
  tenantId: string;
  integrationAccountId: string;
  provider: IntegrationProvider;
  externalType: IntegrationExternalType;
  externalId: string;
  internalType: IntegrationInternalType;
  internalId: string;
  displayName?: string | null;
  status?: IntegrationMappingStatus;
  matchedBy: IntegrationMappingMatchedBy;
  confidence?: Prisma.Decimal | number | string | null;
  canonicalHash?: string | null;
  metadata?: JsonInput;
};

export type CreateSyncJobInput = {
  tenantId: string;
  integrationAccountId?: string | null;
  provider: IntegrationProvider;
  jobType: IntegrationSyncJobType;
  status?: IntegrationSyncJobStatus;
  idempotencyKey: string;
  cursorFrom?: JsonInput | null;
  cursorTo?: JsonInput | null;
  requestedById?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  nextRetryAt?: Date | null;
  attemptCount?: number;
  maxAttempts?: number;
  errorCode?: string | null;
  safeErrorMessage?: string | null;
  stats?: JsonInput;
};

export type RecordHealthEventInput = {
  tenantId: string;
  integrationAccountId?: string | null;
  provider: IntegrationProvider;
  severity: IntegrationHealthSeverity;
  status?: IntegrationHealthStatus;
  eventType: IntegrationHealthEventType;
  messageKey: string;
  safeDetails?: JsonInput;
  correlationId?: string | null;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  resolvedAt?: Date | null;
};
