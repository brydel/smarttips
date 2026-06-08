import { EmployeeRole, Prisma } from '@prisma/client';

import {
  allocateBounded,
  allocateProportional,
  DistributionInputError,
  WeightedAllocand,
} from './allocation';
import { DistributionConfig, EmployeeShiftInput, toEmployeeId } from '../distribution.types';
import { toDecimal } from './money';

function config(overrides: Partial<DistributionConfig> = {}): DistributionConfig {
  return {
    roleCoefficients: {
      [EmployeeRole.SERVER]: toDecimal(1),
      [EmployeeRole.BARTENDER]: toDecimal(1),
      [EmployeeRole.BUSSER]: toDecimal(1),
      [EmployeeRole.HOST]: toDecimal(1),
      [EmployeeRole.COOK]: toDecimal(1),
      [EmployeeRole.CHEF]: toDecimal(1),
    },
    minimumPerHour: toDecimal(0),
    maxSharePercent: toDecimal(70),
    salesBonusWeight: toDecimal(0),
    policyVersion: 'policy-test',
    ...overrides,
  };
}

function allocand(employeeId: string, weight: string, minimumCents = 0): WeightedAllocand {
  return {
    employeeId,
    weight: new Prisma.Decimal(weight),
    minimumCents,
  };
}

function employee(
  employeeId: string,
  hoursWorked: string,
  role = EmployeeRole.SERVER,
): EmployeeShiftInput {
  return {
    employeeId: toEmployeeId(employeeId),
    role,
    hoursWorked: toDecimal(hoursWorked),
    salesGenerated: toDecimal(0),
    coefficient: toDecimal(1),
  };
}

describe('allocateBounded', () => {
  it('allocates exact cents while respecting minimum and cap', () => {
    const result = allocateBounded(
      [allocand('b', '3', 100), allocand('a', '1', 100), allocand('c', '2', 100)],
      toDecimal('10.00'),
      config({ maxSharePercent: toDecimal(60) }),
    );

    expect(result.allocations.reduce((sum, row) => sum + row.finalCents, 0)).toBe(1_000);
    for (const row of result.allocations) {
      expect(row.finalCents).toBeGreaterThanOrEqual(100);
      expect(row.finalCents).toBeLessThanOrEqual(600);
    }
  });

  it('is deterministic and uses employeeId as the fractional tiebreaker', () => {
    const input = [allocand('b', '1'), allocand('a', '1')];

    const first = allocateBounded(
      input,
      toDecimal('0.01'),
      config({ maxSharePercent: toDecimal(100) }),
    );
    const second = allocateBounded(
      input,
      toDecimal('0.01'),
      config({ maxSharePercent: toDecimal(100) }),
    );

    expect(second.allocations).toEqual(first.allocations);
    expect(first.allocations).toEqual([
      expect.objectContaining({ employeeId: 'b', finalCents: 0 }),
      expect.objectContaining({ employeeId: 'a', finalCents: 1 }),
    ]);
  });

  it('lets zero-weight employees absorb remainder when positive weights cap out', () => {
    const result = allocateBounded(
      [allocand('heavy', '100'), allocand('zero-a', '0'), allocand('zero-b', '0')],
      toDecimal('10.00'),
      config({ maxSharePercent: toDecimal(40) }),
    );

    expect(result.allocations.reduce((sum, row) => sum + row.finalCents, 0)).toBe(1_000);
    expect(result.allocations.find((row) => row.employeeId === 'heavy')?.finalCents).toBe(400);
    expect(
      result.allocations.find((row) => row.employeeId === 'zero-a')?.finalCents,
    ).toBeGreaterThan(0);
  });

  it('rejects non-positive total weight', () => {
    expect(() =>
      allocateBounded([allocand('a', '0'), allocand('b', '0')], toDecimal('10.00'), config()),
    ).toThrow(new DistributionInputError('error.distribution.invalidWeights'));
  });
});

describe('allocateProportional', () => {
  it('preserves the rules golden path and stamps audit fields', () => {
    const results = allocateProportional(
      [
        {
          input: employee('server-a', '4'),
          roleCoefficient: toDecimal(1),
          baseScore: toDecimal(4),
          rawScore: toDecimal(4),
          shiftAvgSales: toDecimal(0),
          salesBonus: toDecimal(1),
        },
        {
          input: employee('server-b', '2'),
          roleCoefficient: toDecimal(1),
          baseScore: toDecimal(2),
          rawScore: toDecimal(2),
          shiftAvgSales: toDecimal(0),
          salesBonus: toDecimal(1),
        },
      ],
      toDecimal('30.00'),
      config(),
    );

    expect(results.map((result) => result.amount.toFixed(2))).toEqual(['20.00', '10.00']);
    expect(results[0].explanation).toMatchObject({
      source: 'RULES',
      schemaVersion: 1,
      engineVersion: 'distribution-engine-v1',
      policyVersion: 'policy-test',
      scoreShare: '0.6667',
    });
  });
});
