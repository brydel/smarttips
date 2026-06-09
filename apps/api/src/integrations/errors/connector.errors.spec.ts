import { IntegrationProvider } from '@prisma/client';

import { ProviderAuthError, ProviderRateLimitError } from './connector.errors';

describe('connector errors', () => {
  it('keeps safe machine-readable fields', () => {
    const error = new ProviderRateLimitError({
      safeMessage: 'Provider rate limit reached.',
      provider: IntegrationProvider.SQUARE_POS,
      integrationAccountId: 'account-1',
      details: { retryAfterMs: 1000 },
    });

    expect(error.code).toBe('PROVIDER_RATE_LIMIT_ERROR');
    expect(error.retryable).toBe(true);
    expect(error.provider).toBe(IntegrationProvider.SQUARE_POS);
    expect(error.details).toEqual({ retryAfterMs: 1000 });
  });

  it('redacts unsafe messages and details that look like raw provider payloads or credentials', () => {
    const error = new ProviderAuthError({
      safeMessage: 'token abc123 leaked in provider body',
      details: {
        authorization: 'Bearer secret',
        rawPayload: { token: 'secret' },
        safeCode: 'AUTH_FAILED',
      },
    });

    expect(error.message).toBe('Provider operation failed. See safe error code for details.');
    expect(error.details).toEqual({ safeCode: 'AUTH_FAILED' });
  });
});
