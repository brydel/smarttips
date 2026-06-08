import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import CircuitBreaker from 'opossum';
import { Agent, request } from 'undici';
import { z } from 'zod';

const MAX_EMPLOYEES_PER_SHIFT = 500;
const DEFAULT_PREDICT_TIMEOUT_MS = 150;
const DEFAULT_TRAIN_TIMEOUT_MS = 2_000;
const DEFAULT_TRAIN_MAX_ATTEMPTS = 3;
const DEFAULT_TRAIN_BACKOFF_BASE_MS = 200;
const DEFAULT_MAX_BODY_BYTES = 256_000;

type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type TenantId = Brand<string, 'TenantId'>;
export type ShiftId = Brand<string, 'ShiftId'>;
export type EmployeeId = Brand<string, 'EmployeeId'>;
export type RequestId = Brand<string, 'RequestId'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;
export type Cents = Brand<number, 'Cents'>;

export interface MlEmployeeContext {
  readonly employeeId: EmployeeId;
  readonly role: string;
  readonly shiftType: string;
  readonly dayOfWeek: number;
  readonly hourStart: number;
  readonly hourEnd: number;
  readonly employeeCount: number;
  readonly salesTotalCents: Cents;
  readonly assignedSalesCents: Cents;
  readonly ordersCount: number;
}

export interface PredictDistributionInput {
  readonly tenantId: TenantId;
  readonly shiftId: ShiftId;
  readonly poolCents: Cents;
  readonly employees: readonly MlEmployeeContext[];
  readonly requestId?: RequestId;
}

export interface MlAllocation {
  readonly employeeId: EmployeeId;
  readonly tipsCents: Cents;
  readonly weight: number;
  readonly share: number;
}

export interface DistributionPrediction {
  readonly tenantId: TenantId;
  readonly shiftId: ShiftId;
  readonly poolCents: Cents;
  readonly allocations: readonly MlAllocation[];
  readonly modelVersion: number;
}

export interface TrainEmployeeOutcome extends MlEmployeeContext {
  readonly tipsReceivedCents: Cents;
}

export interface TrainOnFeedbackInput {
  readonly tenantId: TenantId;
  readonly shiftId: ShiftId;
  readonly employees: readonly TrainEmployeeOutcome[];
  readonly idempotencyKey: IdempotencyKey;
  readonly requestId?: RequestId;
}

export interface TrainResult {
  readonly status: string;
  readonly modelVersion: number;
  readonly skippedZeroPool: boolean;
}

export type MlUnavailableReason =
  | 'circuit_open'
  | 'timeout'
  | 'transport'
  | 'bad_response'
  | 'misconfiguration'
  | 'rate_limited'
  | 'upstream_rejected';

export class MlServiceUnavailableException extends Error {
  readonly reason: MlUnavailableReason;

  constructor(reason: MlUnavailableReason, options?: { readonly cause?: unknown }) {
    super(`ml distribution service unavailable: ${reason}`, options);
    this.name = 'MlServiceUnavailableException';
    this.reason = reason;
  }
}

const uuidSchema = z.string().uuid();

const centsSchema = z.number().int().safe().min(0).max(9_999_999_999);
const positiveCentsSchema = centsSchema.min(1);

const employeeBaseSchema = z
  .object({
    employeeId: uuidSchema,
    role: z.string().trim().min(1).max(64),
    shiftType: z.string().trim().min(1).max(64),
    dayOfWeek: z.number().int().min(0).max(6),
    hourStart: z.number().int().min(0).max(23),
    hourEnd: z.number().int().min(1).max(23),
    employeeCount: z.number().int().min(1).max(MAX_EMPLOYEES_PER_SHIFT),
    salesTotalCents: centsSchema,
    assignedSalesCents: centsSchema,
    ordersCount: z.number().int().min(0).max(100_000),
  })
  .strict();

const employeeSchema = employeeBaseSchema.refine((v) => v.hourEnd > v.hourStart, {
  message: 'hourEnd must be greater than hourStart',
});

// Inputs are OURS: keep them strict (extra=forbid) so a typo at a call site fails loud.
const predictInputSchema = z
  .object({
    tenantId: uuidSchema,
    shiftId: uuidSchema,
    poolCents: positiveCentsSchema,
    employees: z.array(employeeSchema).min(1).max(MAX_EMPLOYEES_PER_SHIFT),
    requestId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const trainInputSchema = z
  .object({
    tenantId: uuidSchema,
    shiftId: uuidSchema,
    employees: z
      .array(
        employeeBaseSchema
          .extend({ tipsReceivedCents: centsSchema })
          .refine((v) => v.hourEnd > v.hourStart, {
            message: 'hourEnd must be greater than hourStart',
          }),
      )
      .min(1)
      .max(MAX_EMPLOYEES_PER_SHIFT),
    idempotencyKey: z.string().min(16).max(256),
    requestId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

// Responses come from a service that may evolve: do NOT use .strict() — additive
// fields in a minor ML release must not trip bad_response and force a fallback.
// We validate the fields we depend on and ignore the rest. status is a free string
// and model_version allows 0 (cold-start) for the same forward-compat reason.
const predictionWireSchema = z.object({
  tenant_id: uuidSchema,
  shift_id: uuidSchema,
  pool_cents: positiveCentsSchema,
  allocations: z.array(
    z.object({
      employee_id: uuidSchema,
      tips_cents: centsSchema,
      weight: z.number().finite().min(0).max(1_000_000),
      share: z.number().finite().min(0).max(1),
    }),
  ),
  model_version: z.number().int().safe().min(0),
});

const trainWireSchema = z.object({
  status: z.string().trim().min(1).max(64),
  model_version: z.number().int().safe().min(0),
  skipped_zero_pool: z.boolean(),
});

type PredictionWire = z.infer<typeof predictionWireSchema>;
type TrainWire = z.infer<typeof trainWireSchema>;

@Injectable()
export class MlClientService implements OnApplicationShutdown {
  private readonly logger = new Logger(MlClientService.name);

  private readonly baseUrl: URL;
  private readonly internalToken: string;
  private readonly predictTimeoutMs: number;
  private readonly trainTimeoutMs: number;
  private readonly trainMaxAttempts: number;
  private readonly trainBackoffBaseMs: number;
  private readonly maxBodyBytes: number;
  private readonly dispatcher: Agent;

  private readonly predictBreaker: CircuitBreaker<
    [PredictDistributionInput],
    DistributionPrediction
  >;

  constructor(config: ConfigService) {
    this.baseUrl = this.readAndValidateBaseUrl(config);
    // Static shared secret in X-Internal-Token — matches apps/ml-service security.py
    // exactly. (HMAC request signing is the planned upgrade but requires a coordinated
    // change to security.py on the Python side; tracked as a follow-up security ticket.)
    this.internalToken = this.requireConfig(config, 'INTERNAL_ML_TOKEN');

    this.predictTimeoutMs = this.readPositiveInt(
      config,
      'ML_PREDICT_TIMEOUT_MS',
      DEFAULT_PREDICT_TIMEOUT_MS,
      10,
      2_000,
    );
    this.trainTimeoutMs = this.readPositiveInt(
      config,
      'ML_TRAIN_TIMEOUT_MS',
      DEFAULT_TRAIN_TIMEOUT_MS,
      100,
      30_000,
    );
    this.trainMaxAttempts = this.readPositiveInt(
      config,
      'ML_TRAIN_MAX_ATTEMPTS',
      DEFAULT_TRAIN_MAX_ATTEMPTS,
      1,
      5,
    );
    this.trainBackoffBaseMs = this.readPositiveInt(
      config,
      'ML_TRAIN_BACKOFF_BASE_MS',
      DEFAULT_TRAIN_BACKOFF_BASE_MS,
      10,
      2_000,
    );
    this.maxBodyBytes = this.readPositiveInt(
      config,
      'ML_MAX_BODY_BYTES',
      DEFAULT_MAX_BODY_BYTES,
      16_384,
      1_048_576,
    );

    this.dispatcher = new Agent({
      keepAliveTimeout: 10_000,
      keepAliveMaxTimeout: 30_000,
      connections: 64,
      pipelining: 1,
    });

    // One breaker per instance: the failure domain is the shared ML service, not a
    // tenant. timeout:false — the deadline is enforced via AbortController so the
    // underlying socket is actually cancelled (opossum's own timeout would leak it).
    this.predictBreaker = new CircuitBreaker(this.callPredict.bind(this), {
      name: 'ml-distribution-predict',
      timeout: false,
      errorThresholdPercentage: 50,
      volumeThreshold: 10,
      resetTimeout: 10_000,
      rollingCountTimeout: 30_000,
      rollingCountBuckets: 10,
      capacity: 128,
    } satisfies CircuitBreaker.Options);

    this.predictBreaker.on('open', () =>
      this.logger.warn({ event: 'ml_predict_circuit_open', action: 'serve_rules_fallback' }),
    );
    this.predictBreaker.on('halfOpen', () =>
      this.logger.log({ event: 'ml_predict_circuit_half_open' }),
    );
    this.predictBreaker.on('close', () => this.logger.log({ event: 'ml_predict_circuit_closed' }));
  }

  async onApplicationShutdown(): Promise<void> {
    this.predictBreaker.shutdown();
    await this.dispatcher.close();
  }

  // SYNC hot path (< 200ms budget). No retry: the breaker's rolling window absorbs
  // transient blips and trips on sustained failure -> orchestrator falls back to rules.
  async predictDistribution(input: PredictDistributionInput): Promise<DistributionPrediction> {
    const validated = this.validatePredictInput(input);
    try {
      return await this.predictBreaker.fire(validated);
    } catch (error) {
      throw this.normalizePredictError(error);
    }
  }

  // ASYNC path (BullMQ worker). Latency is irrelevant here, so the 3x backoff lives
  // here, NOT on the breaker — training load/failures must never trip live predictions.
  async trainOnFeedback(input: TrainOnFeedbackInput): Promise<TrainResult> {
    const validated = this.validateTrainInput(input);
    const requestId = validated.requestId ?? toRequestId(randomUUID());
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.trainMaxAttempts; attempt += 1) {
      try {
        return await this.callTrain(validated, requestId);
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === this.trainMaxAttempts) break;

        const delayMs = this.backoffWithFullJitter(attempt);
        this.logger.warn({
          event: 'ml_train_retry',
          requestId,
          attempt,
          maxAttempts: this.trainMaxAttempts,
          delayMs,
          reason: this.errorReason(error),
        });
        await sleep(delayMs);
      }
    }

    this.logger.error({
      event: 'ml_train_exhausted',
      requestId,
      maxAttempts: this.trainMaxAttempts,
      reason: this.errorReason(lastError),
    });
    throw this.toMlError(lastError);
  }

  private async callPredict(input: PredictDistributionInput): Promise<DistributionPrediction> {
    const requestId = input.requestId ?? toRequestId(randomUUID());
    const body = JSON.stringify(this.toPredictWireBody(input));
    const data = await this.postJsonUnknown(
      '/v1/distribution/predict',
      body,
      requestId,
      this.predictTimeoutMs,
    );

    const parsed = this.parsePrediction(data);
    this.assertPredictionInvariants(input, parsed);
    return parsed;
  }

  private async callTrain(input: TrainOnFeedbackInput, requestId: RequestId): Promise<TrainResult> {
    const body = JSON.stringify(this.toTrainWireBody(input));
    const data = await this.postJsonUnknown(
      '/v1/distribution/train',
      body,
      requestId,
      this.trainTimeoutMs,
    );
    return this.parseTrainResult(data);
  }

  private async postJsonUnknown(
    pathname: string,
    body: string,
    requestId: RequestId,
    timeoutMs: number,
  ): Promise<unknown> {
    const url = new URL(pathname, this.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await request(url, {
        method: 'POST',
        body,
        headers: this.buildHeaders(requestId),
        dispatcher: this.dispatcher,
        signal: controller.signal,
        bodyTimeout: timeoutMs,
        headersTimeout: timeoutMs,
      });

      if (response.statusCode === 408 || response.statusCode === 429) {
        await response.body.dump();
        throw new MlServiceUnavailableException('rate_limited');
      }
      if (response.statusCode >= 500) {
        await response.body.dump();
        throw new MlServiceUnavailableException('transport');
      }
      if (response.statusCode < 200 || response.statusCode > 299) {
        await response.body.dump();
        throw new MlServiceUnavailableException('upstream_rejected');
      }

      const contentType = response.headers['content-type'];
      const normalized = Array.isArray(contentType) ? contentType.join(',') : (contentType ?? '');
      if (!normalized.includes('application/json')) {
        await response.body.dump();
        throw new MlServiceUnavailableException('bad_response');
      }

      const text = await response.body.text();
      if (Buffer.byteLength(text, 'utf8') > this.maxBodyBytes) {
        throw new MlServiceUnavailableException('bad_response');
      }
      return JSON.parse(text) as unknown;
    } catch (error) {
      if (isAbortError(error)) throw new MlServiceUnavailableException('timeout', { cause: error });
      if (error instanceof SyntaxError)
        throw new MlServiceUnavailableException('bad_response', { cause: error });
      if (error instanceof MlServiceUnavailableException) throw error;
      throw new MlServiceUnavailableException('transport', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(requestId: RequestId): Record<string, string> {
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-internal-token': this.internalToken,
      'x-request-id': requestId,
    };
  }

  private toPredictWireBody(input: PredictDistributionInput): Record<string, unknown> {
    return {
      tenant_id: input.tenantId,
      shift_id: input.shiftId,
      pool_cents: input.poolCents,
      employees: input.employees.map((employee) => this.toEmployeeWire(employee)),
    };
  }

  private toTrainWireBody(input: TrainOnFeedbackInput): Record<string, unknown> {
    return {
      tenant_id: input.tenantId,
      shift_id: input.shiftId,
      idempotency_key: input.idempotencyKey,
      employees: input.employees.map((employee) => ({
        ...this.toEmployeeWire(employee),
        tips_received_cents: employee.tipsReceivedCents,
      })),
    };
  }

  private toEmployeeWire(employee: MlEmployeeContext): Record<string, unknown> {
    return {
      employee_id: employee.employeeId,
      role: employee.role,
      shift_type: employee.shiftType,
      day_of_week: employee.dayOfWeek,
      hour_start: employee.hourStart,
      hour_end: employee.hourEnd,
      employee_count: employee.employeeCount,
      sales_total_cents: employee.salesTotalCents,
      assigned_sales_cents: employee.assignedSalesCents,
      orders_count: employee.ordersCount,
    };
  }

  private parsePrediction(data: unknown): DistributionPrediction {
    const parsed = predictionWireSchema.safeParse(data);
    if (!parsed.success) {
      throw new MlServiceUnavailableException('bad_response', { cause: parsed.error });
    }
    return this.fromPredictionWire(parsed.data);
  }

  private parseTrainResult(data: unknown): TrainResult {
    const parsed = trainWireSchema.safeParse(data);
    if (!parsed.success) {
      throw new MlServiceUnavailableException('bad_response', { cause: parsed.error });
    }
    return this.fromTrainWire(parsed.data);
  }

  private fromPredictionWire(data: PredictionWire): DistributionPrediction {
    return {
      tenantId: toTenantId(data.tenant_id),
      shiftId: toShiftId(data.shift_id),
      poolCents: toCents(data.pool_cents),
      allocations: data.allocations.map((allocation) => ({
        employeeId: toEmployeeId(allocation.employee_id),
        tipsCents: toCents(allocation.tips_cents),
        weight: allocation.weight,
        share: allocation.share,
      })),
      modelVersion: data.model_version,
    };
  }

  private fromTrainWire(data: TrainWire): TrainResult {
    return {
      status: data.status,
      modelVersion: data.model_version,
      skippedZeroPool: data.skipped_zero_pool,
    };
  }

  // Health gate, NOT the allocation source. The final cents are recomputed from the
  // ML weights via allocateBounded() in the orchestrator (so min/cap are enforced),
  // so tips_cents/sum here are a cheap signal that the model is not visibly broken;
  // a violation means "unusable ML" -> bad_response -> rules fallback.
  private assertPredictionInvariants(
    input: PredictDistributionInput,
    prediction: DistributionPrediction,
  ): void {
    if (prediction.tenantId !== input.tenantId || prediction.shiftId !== input.shiftId) {
      throw new MlServiceUnavailableException('bad_response');
    }
    if (prediction.poolCents !== input.poolCents) {
      throw new MlServiceUnavailableException('bad_response');
    }
    if (prediction.allocations.length !== input.employees.length) {
      throw new MlServiceUnavailableException('bad_response');
    }

    const expectedEmployeeIds = new Set(input.employees.map((employee) => employee.employeeId));
    const seenEmployeeIds = new Set<EmployeeId>();
    let totalTips = 0;
    let totalShare = 0;

    for (const allocation of prediction.allocations) {
      if (
        !expectedEmployeeIds.has(allocation.employeeId) ||
        seenEmployeeIds.has(allocation.employeeId)
      ) {
        throw new MlServiceUnavailableException('bad_response');
      }
      seenEmployeeIds.add(allocation.employeeId);
      totalTips += allocation.tipsCents;
      totalShare += allocation.share;
    }

    if (totalTips !== input.poolCents) {
      throw new MlServiceUnavailableException('bad_response');
    }
    if (Math.abs(totalShare - 1) > 0.0001) {
      throw new MlServiceUnavailableException('bad_response');
    }
  }

  private validatePredictInput(input: PredictDistributionInput): PredictDistributionInput {
    const parsed = predictInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new TypeError('predictDistribution input failed validation');
    }
    return {
      tenantId: toTenantId(parsed.data.tenantId),
      shiftId: toShiftId(parsed.data.shiftId),
      poolCents: toCents(parsed.data.poolCents),
      requestId:
        parsed.data.requestId === undefined ? undefined : toRequestId(parsed.data.requestId),
      employees: parsed.data.employees.map((employee) => this.brandEmployee(employee)),
    };
  }

  private validateTrainInput(input: TrainOnFeedbackInput): TrainOnFeedbackInput {
    const parsed = trainInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new TypeError('trainOnFeedback input failed validation');
    }
    return {
      tenantId: toTenantId(parsed.data.tenantId),
      shiftId: toShiftId(parsed.data.shiftId),
      idempotencyKey: toIdempotencyKey(parsed.data.idempotencyKey),
      requestId:
        parsed.data.requestId === undefined ? undefined : toRequestId(parsed.data.requestId),
      employees: parsed.data.employees.map((employee) => ({
        ...this.brandEmployee(employee),
        tipsReceivedCents: toCents(employee.tipsReceivedCents),
      })),
    };
  }

  private brandEmployee(employee: {
    employeeId: string;
    role: string;
    shiftType: string;
    dayOfWeek: number;
    hourStart: number;
    hourEnd: number;
    employeeCount: number;
    salesTotalCents: number;
    assignedSalesCents: number;
    ordersCount: number;
  }): MlEmployeeContext {
    return {
      employeeId: toEmployeeId(employee.employeeId),
      role: employee.role,
      shiftType: employee.shiftType,
      dayOfWeek: employee.dayOfWeek,
      hourStart: employee.hourStart,
      hourEnd: employee.hourEnd,
      employeeCount: employee.employeeCount,
      salesTotalCents: toCents(employee.salesTotalCents),
      assignedSalesCents: toCents(employee.assignedSalesCents),
      ordersCount: employee.ordersCount,
    };
  }

  private normalizePredictError(error: unknown): MlServiceUnavailableException {
    if (error instanceof MlServiceUnavailableException) return error;
    if (isErrorWithCode(error) && error.code === 'EOPENBREAKER') {
      return new MlServiceUnavailableException('circuit_open', { cause: error });
    }
    if (this.predictBreaker.opened) {
      return new MlServiceUnavailableException('circuit_open', { cause: error });
    }
    return this.toMlError(error);
  }

  private toMlError(error: unknown): MlServiceUnavailableException {
    if (error instanceof MlServiceUnavailableException) return error;
    if (isAbortError(error)) return new MlServiceUnavailableException('timeout', { cause: error });
    return new MlServiceUnavailableException('transport', { cause: error });
  }

  private isRetryable(error: unknown): boolean {
    if (!(error instanceof MlServiceUnavailableException)) return false;
    return (
      error.reason === 'timeout' || error.reason === 'transport' || error.reason === 'rate_limited'
    );
  }

  private errorReason(error: unknown): string {
    if (error instanceof MlServiceUnavailableException) return error.reason;
    if (error instanceof Error) return error.name;
    return 'unknown';
  }

  private backoffWithFullJitter(attempt: number): number {
    const exponentialDelay = this.trainBackoffBaseMs * 2 ** (attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, 5_000);
    return Math.floor(Math.random() * cappedDelay);
  }

  private readAndValidateBaseUrl(config: ConfigService): URL {
    const raw = this.requireConfig(config, 'ML_SERVICE_URL');
    const url = new URL(raw);
    const isProduction = (config.get<string>('NODE_ENV') ?? '').toLowerCase() === 'production';

    // Credentials/query/hash never belong in a service base URL — cheap to reject everywhere.
    if (url.username || url.password || url.search || url.hash) {
      throw new MlServiceUnavailableException('misconfiguration');
    }

    if (isProduction) {
      // Full hardening only in prod, so http://localhost dev + Postman keep working.
      if (url.protocol !== 'https:') throw new MlServiceUnavailableException('misconfiguration');
      if (isForbiddenHostname(url.hostname))
        throw new MlServiceUnavailableException('misconfiguration');

      const allowedHosts = this.requireConfig(config, 'ML_SERVICE_ALLOWED_HOSTS')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter((host) => host.length > 0);

      if (!allowedHosts.includes(url.hostname.toLowerCase())) {
        throw new MlServiceUnavailableException('misconfiguration');
      }
    } else if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new MlServiceUnavailableException('misconfiguration');
    }

    url.pathname = url.pathname.replace(/\/+$/, '');
    return url;
  }

  private readPositiveInt(
    config: ConfigService,
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = config.get<string | number>(key);
    // Env vars arrive as strings unless the env schema coerces them — coerce defensively.
    const value = raw === undefined || raw === null || raw === '' ? fallback : Number(raw);

    if (!Number.isInteger(value) || value < min || value > max) {
      throw new MlServiceUnavailableException('misconfiguration');
    }
    return value;
  }

  private requireConfig(config: ConfigService, key: string): string {
    const value = config.get<string>(key);
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new MlServiceUnavailableException('misconfiguration');
    }
    return value.trim();
  }
}

function toTenantId(value: string): TenantId {
  return value as TenantId;
}

function toShiftId(value: string): ShiftId {
  return value as ShiftId;
}

function toEmployeeId(value: string): EmployeeId {
  return value as EmployeeId;
}

function toRequestId(value: string): RequestId {
  return value as RequestId;
}

function toIdempotencyKey(value: string): IdempotencyKey {
  return value as IdempotencyKey;
}

function toCents(value: number): Cents {
  return value as Cents;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isErrorWithCode(value: unknown): value is { readonly code?: string } {
  return typeof value === 'object' && value !== null && 'code' in value;
}

function isForbiddenHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === 'metadata.google.internal' ||
    normalized.endsWith('.local') ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.startsWith('169.254.') ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./u.test(normalized)
  );
}
