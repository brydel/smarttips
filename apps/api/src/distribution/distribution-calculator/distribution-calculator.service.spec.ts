import { ComputationMethod, EmployeeRole, Prisma } from '@prisma/client';

import { DistributionCalculatorService, MlPrediction } from './distribution-calculator.service';
import {
  DistributionInput,
  toEmployeeId,
  toShiftId,
  toTenantId,
  toTipPoolId,
} from '../distribution.types';
import { toDecimal } from './money';
import { DistributionInputError } from './allocation';

function input(): DistributionInput {
  return {
    tenantId: toTenantId('tenant'),
    tipPoolId: toTipPoolId('pool'),
    shiftId: toShiftId('shift'),
    totalAmount: toDecimal('100.00'),
    computationMethod: ComputationMethod.RULES,
    config: {
      roleCoefficients: {
        [EmployeeRole.SERVER]: toDecimal(1),
        [EmployeeRole.BARTENDER]: toDecimal(1),
        [EmployeeRole.BUSSER]: toDecimal(1),
        [EmployeeRole.HOST]: toDecimal(1),
        [EmployeeRole.COOK]: toDecimal(1),
        [EmployeeRole.CHEF]: toDecimal(1),
      },
      minimumPerHour: toDecimal(0),
      maxSharePercent: toDecimal(80),
      salesBonusWeight: toDecimal(0),
      policyVersion: 'policy-test',
    },
    employees: [
      {
        employeeId: toEmployeeId('a'),
        role: EmployeeRole.SERVER,
        hoursWorked: toDecimal(8),
        salesGenerated: toDecimal(0),
        coefficient: toDecimal(1),
      },
      {
        employeeId: toEmployeeId('b'),
        role: EmployeeRole.SERVER,
        hoursWorked: toDecimal(2),
        salesGenerated: toDecimal(0),
        coefficient: toDecimal(1),
      },
    ],
  };
}

function prediction(): MlPrediction {
  return {
    modelVersion: 0,
    weights: [
      {
        employeeId: toEmployeeId('a'),
        weight: new Prisma.Decimal('1'),
        share: new Prisma.Decimal('0.25'),
      },
      {
        employeeId: toEmployeeId('b'),
        weight: new Prisma.Decimal('3'),
        share: new Prisma.Decimal('0.75'),
      },
    ],
  };
}

describe('DistributionCalculatorService', () => {
  const service = new DistributionCalculatorService();

  it('compute returns realized RULES method', () => {
    const result = service.compute(input());

    expect(result.computationMethod).toBe(ComputationMethod.RULES);
    expect(result.results[0].explanation.source).toBe('RULES');
  });

  it('ML_FULL uses raw ML weights and accepts cold-start modelVersion 0', () => {
    const result = service.computeFromMl(input(), prediction(), 'ML_FULL');

    expect(result.computationMethod).toBe(ComputationMethod.ML_FULL);
    expect(result.results.map((row) => row.amount.toFixed(2))).toEqual(['25.00', '75.00']);
    expect(result.results[0].explanation).toMatchObject({
      source: 'ML_FULL',
      modelVersion: 0,
      mlWeight: '1.0000',
      mlShare: '0.2500',
    });
  });

  it('ML_ASSISTED blends in share space and stamps blend explanation', () => {
    const result = service.computeFromMl(input(), prediction(), 'ML_ASSISTED');

    expect(result.computationMethod).toBe(ComputationMethod.ML_ASSISTED);
    expect(result.results.map((row) => row.amount.toFixed(2))).toEqual(['52.50', '47.50']);
    expect(result.results[0].explanation).toMatchObject({
      source: 'ML_ASSISTED',
      rulesShare: '0.8000',
      mlShare: '0.2500',
      blendAlpha: '0.5000',
      scoreShare: '0.5250',
    });
  });

  it.each([
    [
      'duplicate employee',
      {
        modelVersion: 1,
        weights: [
          { employeeId: toEmployeeId('a'), weight: toDecimal(1), share: toDecimal('0.5') },
          { employeeId: toEmployeeId('a'), weight: toDecimal(1), share: toDecimal('0.5') },
        ],
      },
      'error.distribution.mlPredictionDuplicateEmployee',
    ],
    [
      'share sum',
      {
        modelVersion: 1,
        weights: [
          { employeeId: toEmployeeId('a'), weight: toDecimal(1), share: toDecimal('0.4') },
          { employeeId: toEmployeeId('b'), weight: toDecimal(1), share: toDecimal('0.4') },
        ],
      },
      'error.distribution.mlPredictionShareSumInvalid',
    ],
  ] as const)('rejects invalid ML prediction: %s', (_name, badPrediction, message) => {
    expect(() => service.computeFromMl(input(), badPrediction, 'ML_FULL')).toThrow(
      new DistributionInputError(message),
    );
  });
});
