jest.mock('node:worker_threads', () => ({
  ...jest.requireActual('node:worker_threads'),
  markAsUncloneable: jest.fn(),
}));

import { ComputationMethod } from '@prisma/client';
import { Job } from 'bullmq';

import {
  Cents,
  EmployeeId,
  IdempotencyKey,
  MlClientService,
  ShiftId,
  TenantId,
  TrainEmployeeOutcome,
} from '../ml-client/ml-client.service';
import { MlTrainingJobData } from './ml-training.producer';
import { MlTrainingProcessor } from './ml-training.processor';

function brand<T>(value: string | number): T {
  return value as T;
}

function employee(): TrainEmployeeOutcome {
  return {
    employeeId: brand<EmployeeId>('employee-a'),
    role: 'SERVER',
    shiftType: 'DINNER',
    dayOfWeek: 4,
    hourStart: 17,
    hourEnd: 23,
    employeeCount: 1,
    salesTotalCents: brand<Cents>(10_000),
    assignedSalesCents: brand<Cents>(10_000),
    ordersCount: 12,
    tipsReceivedCents: brand<Cents>(1_000),
  };
}

function job(computationMethod: ComputationMethod): Job<MlTrainingJobData> {
  return {
    id: 'job-id',
    attemptsMade: 1,
    data: {
      tenantId: brand<TenantId>('tenant-id'),
      shiftId: brand<ShiftId>('shift-id'),
      computationMethod,
      employees: [employee()],
      idempotencyKey: brand<IdempotencyKey>('tenant:shift:distribution:hash'),
    },
  } as unknown as Job<MlTrainingJobData>;
}

describe('MlTrainingProcessor', () => {
  it('calls the ML client for ML feedback jobs', async () => {
    const mlClient = {
      trainOnFeedback: jest.fn().mockResolvedValue({
        status: 'trained',
        modelVersion: 1,
        skippedZeroPool: false,
      }),
    } as unknown as MlClientService;
    const processor = new MlTrainingProcessor(mlClient);

    await processor.process(job(ComputationMethod.ML_ASSISTED));

    expect(mlClient.trainOnFeedback).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      shiftId: 'shift-id',
      employees: [employee()],
      idempotencyKey: 'tenant:shift:distribution:hash',
    });
  });

  it.each([ComputationMethod.RULES, ComputationMethod.MANUAL_OVERRIDE])(
    'skips fallback or manual jobs with method %s',
    async (computationMethod) => {
      const mlClient = {
        trainOnFeedback: jest.fn(),
      } as unknown as MlClientService;
      const processor = new MlTrainingProcessor(mlClient);

      await processor.process(job(computationMethod));

      expect(mlClient.trainOnFeedback).not.toHaveBeenCalled();
    },
  );
});
