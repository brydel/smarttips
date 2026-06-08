jest.mock('node:worker_threads', () => ({
  ...jest.requireActual('node:worker_threads'),
  markAsUncloneable: jest.fn(),
}));

import { ConfigService } from '@nestjs/config';
import { MockAgent } from 'undici';

import {
  Cents,
  EmployeeId,
  MlClientService,
  MlEmployeeContext,
  ShiftId,
  TenantId,
} from './ml-client.service';

const BASE_URL = 'http://ml-service.test';
const TOKEN = 'test-internal-token-with-at-least-32-chars';

function brand<T>(value: string | number): T {
  return value as T;
}

function config(values: Record<string, string | number>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function createClient(): { readonly client: MlClientService; readonly agent: MockAgent } {
  const client = new MlClientService(
    config({
      ML_SERVICE_URL: BASE_URL,
      INTERNAL_ML_TOKEN: TOKEN,
      ML_PREDICT_TIMEOUT_MS: 50,
      ML_TRAIN_TIMEOUT_MS: 200,
      ML_TRAIN_MAX_ATTEMPTS: 3,
      ML_TRAIN_BACKOFF_BASE_MS: 10,
      ML_MAX_BODY_BYTES: 256_000,
      NODE_ENV: 'test',
    }),
  );
  const agent = new MockAgent();
  agent.disableNetConnect();
  Object.defineProperty(client, 'dispatcher', { value: agent });

  return { client, agent };
}

function employee(id = '11111111-1111-4111-8111-111111111111'): MlEmployeeContext {
  return {
    employeeId: brand<EmployeeId>(id),
    role: 'SERVER',
    shiftType: 'DINNER',
    dayOfWeek: 4,
    hourStart: 17,
    hourEnd: 23,
    employeeCount: 1,
    salesTotalCents: brand<Cents>(10_000),
    assignedSalesCents: brand<Cents>(10_000),
    ordersCount: 12,
  };
}

function predictInput() {
  return {
    tenantId: brand<TenantId>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    shiftId: brand<ShiftId>('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    poolCents: brand<Cents>(1_000),
    employees: [employee()],
  };
}

function jsonHeaders() {
  return { headers: { 'content-type': 'application/json' } };
}

describe('MlClientService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps predict responses and sends the internal token without schema_version', async () => {
    const { client, agent } = createClient();
    const input = predictInput();
    let capturedBody: unknown;
    let sawInternalToken = false;

    agent
      .get(BASE_URL)
      .intercept({
        path: '/v1/distribution/predict',
        method: 'POST',
        headers: (headers) => {
          sawInternalToken = headers['x-internal-token'] === TOKEN;
          return sawInternalToken;
        },
        body: (body) => {
          capturedBody = JSON.parse(body) as unknown;
          return true;
        },
      })
      .reply(
        200,
        {
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          pool_cents: input.poolCents,
          allocations: [
            {
              employee_id: input.employees[0].employeeId,
              tips_cents: 1_000,
              weight: 0.75,
              share: 1,
            },
          ],
          model_version: 7,
        },
        jsonHeaders(),
      );

    const prediction = await client.predictDistribution(input);

    expect(sawInternalToken).toBe(true);
    expect(capturedBody).toMatchObject({
      tenant_id: input.tenantId,
      shift_id: input.shiftId,
      pool_cents: input.poolCents,
    });
    expect(capturedBody).not.toHaveProperty('schema_version');
    expect(prediction.modelVersion).toBe(7);
    expect(prediction.allocations[0]).toMatchObject({
      employeeId: input.employees[0].employeeId,
      tipsCents: 1_000,
      weight: 0.75,
      share: 1,
    });

    await client.onApplicationShutdown();
  });

  it.each([
    [500, 'transport'],
    [429, 'rate_limited'],
  ] as const)('maps HTTP %i to %s', async (statusCode, reason) => {
    const { client, agent } = createClient();

    agent
      .get(BASE_URL)
      .intercept({
        path: '/v1/distribution/predict',
        method: 'POST',
      })
      .reply(statusCode, { error: 'upstream' }, jsonHeaders());

    await expect(client.predictDistribution(predictInput())).rejects.toMatchObject({
      reason,
    });

    await client.onApplicationShutdown();
  });

  it('maps malformed JSON responses to bad_response', async () => {
    const { client, agent } = createClient();

    agent
      .get(BASE_URL)
      .intercept({
        path: '/v1/distribution/predict',
        method: 'POST',
      })
      .reply(200, '{', jsonHeaders());

    await expect(client.predictDistribution(predictInput())).rejects.toMatchObject({
      reason: 'bad_response',
    });

    await client.onApplicationShutdown();
  });

  it('rejects prediction invariant violations as bad_response', async () => {
    const { client, agent } = createClient();
    const input = predictInput();

    agent
      .get(BASE_URL)
      .intercept({
        path: '/v1/distribution/predict',
        method: 'POST',
      })
      .reply(
        200,
        {
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          pool_cents: input.poolCents,
          allocations: [
            {
              employee_id: '22222222-2222-4222-8222-222222222222',
              tips_cents: 1_000,
              weight: 0.5,
              share: 1,
            },
          ],
          model_version: 1,
        },
        jsonHeaders(),
      );

    await expect(client.predictDistribution(input)).rejects.toMatchObject({
      reason: 'bad_response',
    });

    await client.onApplicationShutdown();
  });
});
