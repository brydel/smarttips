import { createHash } from 'crypto';
import { IntegrationProvider, IntegrationSyncJobType } from '@prisma/client';

export type SyncJobKeyInput = {
  tenantId: string;
  provider: IntegrationProvider;
  integrationAccountId: string;
  jobType: IntegrationSyncJobType;
  window?: Record<string, unknown>;
  cursor?: Record<string, unknown>;
};

export type CanonicalEntityKeyInput = {
  tenantId: string;
  provider: IntegrationProvider;
  integrationAccountId: string;
  entityType: string;
  externalId: string;
  version?: string | number | null;
};

export type ProviderWindowKeyInput = {
  tenantId: string;
  provider: IntegrationProvider;
  integrationAccountId: string;
  from: string;
  to: string;
  locationExternalId?: string;
};

export function buildSyncJobIdempotencyKey(input: SyncJobKeyInput): string {
  return buildKey('sync-job', input);
}

export function buildCanonicalEntityIdempotencyKey(input: CanonicalEntityKeyInput): string {
  return buildKey('canonical-entity', input);
}

export function buildProviderWindowIdempotencyKey(input: ProviderWindowKeyInput): string {
  return buildKey('provider-window', input);
}

function buildKey(prefix: string, input: Record<string, unknown>): string {
  return `${prefix}:${sha256(stableStringify(input))}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',')}}`;
}
