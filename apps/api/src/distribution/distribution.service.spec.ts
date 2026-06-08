jest.mock('node:worker_threads', () => ({
  ...jest.requireActual('node:worker_threads'),
  markAsUncloneable: jest.fn(),
}));

import {
  ComputationMethod,
  DistributionMode,
  EmployeeRole,
  ShiftStatus,
  TipPoolStatus,
} from '@prisma/client';

import { DistributionCalculatorService } from './distribution-calculator/distribution-calculator.service';
import { DistributionService } from './distribution.service';
import {
  DistributionComputationResult,
  toEmployeeId,
  toShiftId,
  toTenantId,
  toTipPoolId,
} from './distribution.types';
import { MlClientService, MlServiceUnavailableException } from '../ml-client/ml-client.service';
import { MlTrainingProducer } from '../queue/ml-training.producer';
import { PrismaService } from '../prisma/prisma.service';
import { toDecimal } from './distribution-calculator/money';

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SHIFT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TIP_POOL_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const EMPLOYEE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function computation(method: ComputationMethod): DistributionComputationResult {
  const explanation =
    method === ComputationMethod.RULES
      ? ({
          source: 'RULES',
          schemaVersion: 1,
          engineVersion: 'distribution-engine-v1',
          policyVersion: 'policy-test',
          scoreShare: '1.0000',
          rawAmount: '10.00',
          capAmount: '10.00',
          minAmount: '0.00',
          capApplied: false,
          minimumApplied: false,
          roundingAdjustmentCents: 0,
          finalAmount: '10.00',
          roleCoefficient: '1.0000',
          employeeCoefficient: '1.0000',
          hoursWorked: '4.0000',
          salesGenerated: '0.00',
          shiftAvgSales: '0.00',
          salesBonus: '1.0000',
          baseScore: '4.0000',
          rawScore: '4.0000',
        } as const)
      : ({
          source: 'ML_FULL',
          schemaVersion: 1,
          engineVersion: 'distribution-engine-v1',
          policyVersion: 'policy-test',
          scoreShare: '1.0000',
          rawAmount: '10.00',
          capAmount: '10.00',
          minAmount: '0.00',
          capApplied: false,
          minimumApplied: false,
          roundingAdjustmentCents: 0,
          finalAmount: '10.00',
          modelVersion: 1,
          mlWeight: '1.0000',
          mlShare: '1.0000',
        } as const);

  return {
    tenantId: toTenantId(TENANT_ID),
    shiftId: toShiftId(SHIFT_ID),
    tipPoolId: toTipPoolId(TIP_POOL_ID),
    computationMethod: method,
    totalAmount: toDecimal('10.00'),
    distributedAmount: toDecimal('10.00'),
    remainderCents: 0,
    results: [
      {
        employeeId: toEmployeeId(EMPLOYEE_ID),
        amount: toDecimal('10.00'),
        contributionScore: toDecimal(1),
        explanation,
      },
    ],
  };
}

function shift(mode: DistributionMode) {
  return {
    id: SHIFT_ID,
    status: ShiftStatus.CLOSED,
    shiftType: 'DINNER',
    date: new Date('2026-06-05T00:00:00.000Z'),
    startTime: new Date('2026-06-05T17:00:00.000Z'),
    endTime: new Date('2026-06-05T23:00:00.000Z'),
    tipPool: {
      id: TIP_POOL_ID,
      status: TipPoolStatus.DECLARED,
      totalAmount: toDecimal('10.00'),
    },
    assignments: [
      {
        employeeId: EMPLOYEE_ID,
        roleDuringShift: EmployeeRole.SERVER,
        scheduledHours: toDecimal(4),
        hoursWorked: toDecimal(4),
        employee: {
          coefficient: toDecimal(1),
          active: true,
          deletedAt: null,
        },
      },
    ],
    mode,
  };
}

function config(mode: DistributionMode) {
  return {
    roleCoefficients: {
      [EmployeeRole.SERVER]: '1.0',
      [EmployeeRole.BARTENDER]: '1.0',
      [EmployeeRole.BUSSER]: '1.0',
      [EmployeeRole.HOST]: '1.0',
      [EmployeeRole.COOK]: '1.0',
      [EmployeeRole.CHEF]: '1.0',
    },
    minPerHour: toDecimal(0),
    maxSharePct: toDecimal(100),
    salesBonusWeight: toDecimal(0),
    mode,
    updatedAt: new Date('2026-06-05T12:00:00.000Z'),
  };
}

function prismaMock(mode: DistributionMode, events: string[]) {
  const freshPool = {
    status: TipPoolStatus.DECLARED,
    totalAmount: toDecimal('10.00'),
    shift: {
      status: ShiftStatus.CLOSED,
      assignments: [{ id: 'assignment-id' }],
    },
  };
  const tx = {
    tipPool: {
      findFirst: jest.fn().mockResolvedValue(freshPool),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    tipDistribution: {
      count: jest.fn().mockResolvedValue(0),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    shift: {
      findFirst: jest.fn().mockResolvedValue(shift(mode)),
    },
    tipDistribution: {
      count: jest.fn().mockResolvedValue(0),
    },
    distributionConfig: {
      findUnique: jest.fn().mockResolvedValue(config(mode)),
    },
    order: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) => {
      events.push('transaction');
      await callback(tx);
    }),
  };

  return { prisma: prisma as unknown as PrismaService, raw: prisma, tx };
}

function serviceParts(mode: DistributionMode) {
  const events: string[] = [];
  const { prisma, raw, tx } = prismaMock(mode, events);
  const calculator = {
    compute: jest.fn().mockReturnValue(computation(ComputationMethod.RULES)),
    computeFromMl: jest.fn().mockReturnValue(computation(ComputationMethod.ML_FULL)),
  } as unknown as DistributionCalculatorService;
  const mlClient = {
    predictDistribution: jest.fn(async () => {
      events.push('predict');
      return {
        tenantId: TENANT_ID,
        shiftId: SHIFT_ID,
        poolCents: 1_000,
        modelVersion: 1,
        allocations: [{ employeeId: EMPLOYEE_ID, tipsCents: 1_000, weight: 1, share: 1 }],
      };
    }),
  } as unknown as MlClientService;
  const producer = {
    enqueue: jest.fn(),
  } as unknown as MlTrainingProducer;
  const service = new DistributionService(prisma, calculator, mlClient, producer);

  return { service, calculator, mlClient, raw, tx, events };
}

describe('DistributionService orchestration', () => {
  it('falls back from ML_FULL to rules and persists realized RULES method', async () => {
    const parts = serviceParts(DistributionMode.ML_FULL);
    jest
      .spyOn(parts.mlClient, 'predictDistribution')
      .mockRejectedValue(new MlServiceUnavailableException('transport'));

    await parts.service.distribute(TENANT_ID, SHIFT_ID);

    expect(parts.calculator.compute).toHaveBeenCalledTimes(1);
    expect(parts.calculator.computeFromMl).not.toHaveBeenCalled();
    expect(parts.tx.tipDistribution.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: TENANT_ID,
          employeeId: EMPLOYEE_ID,
          computationMethod: ComputationMethod.RULES,
        }),
      ],
    });
  });

  it('persists ML_FULL when ML prediction succeeds and runs outside the write transaction', async () => {
    const parts = serviceParts(DistributionMode.ML_FULL);

    await parts.service.distribute(TENANT_ID, SHIFT_ID);

    expect(parts.calculator.computeFromMl).toHaveBeenCalledTimes(1);
    expect(parts.tx.tipDistribution.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          computationMethod: ComputationMethod.ML_FULL,
        }),
      ],
    });
    expect(parts.events).toEqual(['predict', 'transaction']);
  });

  it('does not call ML in RULES_ONLY mode', async () => {
    const parts = serviceParts(DistributionMode.RULES_ONLY);

    await parts.service.distribute(TENANT_ID, SHIFT_ID);

    expect(parts.mlClient.predictDistribution).not.toHaveBeenCalled();
    expect(parts.calculator.compute).toHaveBeenCalledTimes(1);
  });

  it('propagates non-availability ML errors instead of falling back', async () => {
    const parts = serviceParts(DistributionMode.ML_FULL);
    const error = new Error('programmer error');
    jest.spyOn(parts.mlClient, 'predictDistribution').mockRejectedValue(error);

    await expect(parts.service.distribute(TENANT_ID, SHIFT_ID)).rejects.toBe(error);
    expect(parts.raw.$transaction).not.toHaveBeenCalled();
  });
});
