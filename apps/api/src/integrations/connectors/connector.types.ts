import {
  IntegrationCategory,
  IntegrationCredentialStatus,
  IntegrationProvider,
} from '@prisma/client';

import {
  CanonicalEmployee,
  CanonicalLocation,
  CanonicalSale,
  CanonicalTimeEntry,
  CanonicalTip,
} from '../canonical/canonical.types';
import { ProviderRateLimitState } from '../rate-limit/rate-limit.types';

export type ConnectorCapability =
  | 'LOCATIONS'
  | 'EMPLOYEES'
  | 'SHIFTS'
  | 'SALES'
  | 'TIPS'
  | 'TIME_ENTRIES'
  | 'ACCOUNTING_EXPORT'
  | 'EMAIL'
  | 'SMS'
  | 'BILLING';

export type ConnectorRequestContext = {
  tenantId: string;
  integrationAccountId: string;
  requestId?: string;
  dryRun?: boolean;
  actorUserId?: string;
};

export type ValidateConfigInput = {
  tenantId: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  config: Record<string, unknown>;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings?: string[];
};

export type ConnectInput = ConnectorRequestContext & {
  config: Record<string, unknown>;
};

export type ConnectResult = {
  provider: IntegrationProvider;
  integrationAccountId: string;
  connected: boolean;
  externalAccountId?: string;
  externalMerchantId?: string;
  scopes?: string[];
  safeMetadata?: Record<string, unknown>;
};

export type RefreshCredentialsInput = ConnectorRequestContext;

export type CredentialRefreshResult = {
  status: IntegrationCredentialStatus;
  expiresAt?: string;
  refreshedAt: string;
};

export type DisconnectInput = ConnectorRequestContext & {
  reason?: string;
};

export type DisconnectResult = {
  disconnected: boolean;
  disconnectedAt: string;
};

export type SyncWindowRequest = ConnectorRequestContext & {
  startAt: string;
  endAt: string;
  locationExternalIds?: string[];
  cursor?: Record<string, unknown>;
  limit?: number;
};

export type SyncResult<T> = {
  items: T[];
  nextCursor?: Record<string, unknown>;
  hasMore: boolean;
  stats: {
    fetched: number;
    accepted: number;
    rejected: number;
  };
  warnings?: string[];
};

export type ConnectorHealth = {
  provider: IntegrationProvider;
  integrationAccountId: string;
  healthy: boolean;
  checkedAt: string;
  latencyMs?: number;
  rateLimit?: ProviderRateLimitState;
  safeMessage?: string;
};

export type ConnectorListLocationsResult = SyncResult<CanonicalLocation>;
export type ConnectorListEmployeesResult = SyncResult<CanonicalEmployee>;
export type ConnectorSyncSalesResult = SyncResult<CanonicalSale>;
export type ConnectorSyncTipsResult = SyncResult<CanonicalTip>;
export type ConnectorSyncTimeEntriesResult = SyncResult<CanonicalTimeEntry>;
