import { IntegrationProvider } from '@prisma/client';

export type ProviderRateLimitState = {
  provider: IntegrationProvider;
  integrationAccountId: string;
  remaining?: number;
  limit?: number;
  resetAt?: string;
  retryAfterMs?: number;
  observedAt: string;
};

export type ProviderRateLimitDecision = {
  allowed: boolean;
  retryAfterMs?: number;
  reason?: string;
};

export type ProviderRateLimitPolicy = {
  provider: IntegrationProvider;
  maxRequests: number;
  windowMs: number;
  burst?: number;
};
