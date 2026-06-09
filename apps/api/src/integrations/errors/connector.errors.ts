import { IntegrationProvider } from '@prisma/client';

export type ConnectorErrorCode =
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_RATE_LIMIT_ERROR'
  | 'PROVIDER_UNAVAILABLE_ERROR'
  | 'PROVIDER_VALIDATION_ERROR'
  | 'PROVIDER_CONFLICT_ERROR'
  | 'PROVIDER_MAPPING_ERROR'
  | 'PROVIDER_PARTIAL_FAILURE_ERROR'
  | 'UNSUPPORTED_CAPABILITY';

const SENSITIVE_KEY_PATTERN =
  /(authorization|token|secret|api[-_]?key|password|credential|header|cookie|raw|payload|body)/i;

export type ConnectorErrorOptions = {
  code: ConnectorErrorCode;
  safeMessage: string;
  retryable: boolean;
  provider?: IntegrationProvider;
  integrationAccountId?: string;
  details?: Record<string, unknown>;
};

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly retryable: boolean;
  readonly provider?: IntegrationProvider;
  readonly integrationAccountId?: string;
  readonly details?: Record<string, unknown>;

  constructor(options: ConnectorErrorOptions) {
    super(sanitizeMessage(options.safeMessage));
    this.name = this.constructor.name;
    this.code = options.code;
    this.retryable = options.retryable;
    this.provider = options.provider;
    this.integrationAccountId = options.integrationAccountId;
    this.details = options.details ? sanitizeDetails(options.details) : undefined;
  }
}

export class ProviderAuthError extends ConnectorError {
  constructor(options: Omit<ConnectorErrorOptions, 'code' | 'retryable'>) {
    super({ ...options, code: 'PROVIDER_AUTH_ERROR', retryable: false });
  }
}

export class ProviderRateLimitError extends ConnectorError {
  constructor(options: Omit<ConnectorErrorOptions, 'code' | 'retryable'>) {
    super({ ...options, code: 'PROVIDER_RATE_LIMIT_ERROR', retryable: true });
  }
}

export class ProviderUnavailableError extends ConnectorError {
  constructor(options: Omit<ConnectorErrorOptions, 'code' | 'retryable'>) {
    super({ ...options, code: 'PROVIDER_UNAVAILABLE_ERROR', retryable: true });
  }
}

export class ProviderValidationError extends ConnectorError {
  constructor(options: Omit<ConnectorErrorOptions, 'code' | 'retryable'>) {
    super({ ...options, code: 'PROVIDER_VALIDATION_ERROR', retryable: false });
  }
}

export class ProviderConflictError extends ConnectorError {
  constructor(options: Omit<ConnectorErrorOptions, 'code' | 'retryable'>) {
    super({ ...options, code: 'PROVIDER_CONFLICT_ERROR', retryable: false });
  }
}

export class ProviderMappingError extends ConnectorError {
  constructor(options: Omit<ConnectorErrorOptions, 'code' | 'retryable'>) {
    super({ ...options, code: 'PROVIDER_MAPPING_ERROR', retryable: false });
  }
}

export class ProviderPartialFailureError extends ConnectorError {
  constructor(options: Omit<ConnectorErrorOptions, 'code' | 'retryable'>) {
    super({ ...options, code: 'PROVIDER_PARTIAL_FAILURE_ERROR', retryable: true });
  }
}

export class UnsupportedCapabilityError extends ConnectorError {
  constructor(options: Omit<ConnectorErrorOptions, 'code' | 'retryable'>) {
    super({ ...options, code: 'UNSUPPORTED_CAPABILITY', retryable: false });
  }
}

function sanitizeMessage(message: string): string {
  if (SENSITIVE_KEY_PATTERN.test(message)) {
    return 'Provider operation failed. See safe error code for details.';
  }

  return message;
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key)),
  );
}
