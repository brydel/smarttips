import { Injectable } from '@nestjs/common';
import { ComputationMethod, Prisma } from '@prisma/client';

import {
  DISTRIBUTION_ENGINE_VERSION,
  DISTRIBUTION_EXPLANATION_SCHEMA_VERSION,
  DistributionComputationResult,
  DistributionConfig,
  DistributionInput,
  DistributionResult,
  EmployeeId,
  MlAssistedExplanation,
  MlFullExplanation,
} from '../distribution.types';
import {
  assertPoolIntegrity,
  centsToDecimal,
  decimalToJson,
  moneyToJson,
  roundMoney,
  sumDecimals,
  toCents,
  toDecimal,
} from './money';
import {
  allocateBounded,
  allocateProportional,
  computeScores,
  DistributionInputError,
  DistributionInvariantError,
  WeightedAllocand,
} from './allocation';

const MAX_EMPLOYEES_PER_DISTRIBUTION = 500;
const MAX_ML_WEIGHT = new Prisma.Decimal('1000000');
const SHARE_SUM_TOLERANCE = new Prisma.Decimal('0.0001');

// Convex-blend weight given to the ML share in ML_ASSISTED. Fixed for V2 and
// documented in the ADR; promoted to per-tenant config in a later version.
const DEFAULT_ML_ASSISTED_ALPHA = new Prisma.Decimal('0.5');

// Weight basis the orchestrator hands over per employee, mapped from the ML
// prediction response. weight is the raw model weight; share is the model's own
// normalized share (the blend component for ML_ASSISTED — blending in SHARE space
// keeps it dimensionally sound). Defined here so the calculator never depends on
// the transport layer (ml-client); the orchestrator maps the prediction onto it.
export interface MlWeightInput {
  readonly employeeId: EmployeeId;
  readonly weight: Prisma.Decimal;
  readonly share: Prisma.Decimal;
}

export interface MlPrediction {
  readonly weights: readonly MlWeightInput[];
  readonly modelVersion: number;
}

export type MlComputationMode = 'ML_FULL' | 'ML_ASSISTED';

interface BaseExplanationInput {
  readonly config: DistributionConfig;
  readonly scoreShare: Prisma.Decimal;
  readonly rawAmount: Prisma.Decimal;
  readonly capCents: number;
  readonly minimumAmount: Prisma.Decimal;
  readonly capApplied: boolean;
  readonly minimumApplied: boolean;
  readonly finalCents: number;
}

@Injectable()
export class DistributionCalculatorService {
  // RULES path. The realized ComputationMethod is RULES because this method ran —
  // it is never read from input.computationMethod (which the orchestrator must not
  // be relied on to keep in sync with the path actually taken, esp. on fallback).
  compute(input: DistributionInput): DistributionComputationResult {
    this.validateInput(input);

    const totalAmount = roundMoney(input.totalAmount);
    const scored = computeScores(input.employees, input.config);
    const results = allocateProportional(scored, totalAmount, input.config);

    return this.finalize(input, ComputationMethod.RULES, totalAmount, results);
  }

  // ML path. ML_FULL uses the raw model weights; ML_ASSISTED blends the model's
  // share with the rules share in SHARE space, then both go through the SAME
  // bounded allocator so min/cap guarantees hold regardless of source.
  computeFromMl(
    input: DistributionInput,
    prediction: MlPrediction,
    mode: MlComputationMode,
  ): DistributionComputationResult {
    this.validateInput(input);

    const predictionByEmployee = this.validateAndIndexPrediction(input, prediction);
    const totalAmount = roundMoney(input.totalAmount);
    const alpha = this.getMlAssistedAlpha();

    const rulesShareByEmployee =
      mode === 'ML_ASSISTED' ? this.computeRulesShares(input) : undefined;

    const allocands = input.employees.map((employee): WeightedAllocand => {
      const ml = predictionByEmployee.get(employee.employeeId);

      if (!ml) {
        throw new DistributionInvariantError('error.distribution.mlPredictionMissingEmployee');
      }

      const weight =
        mode === 'ML_FULL'
          ? ml.weight
          : this.blendShare(employee.employeeId, ml.share, rulesShareByEmployee, alpha);

      return {
        employeeId: employee.employeeId,
        weight,
        minimumCents: toCents(input.config.minimumPerHour.mul(employee.hoursWorked)),
      };
    });

    const allocation = allocateBounded(allocands, totalAmount, input.config);

    const results = input.employees.map((employee, index): DistributionResult => {
      const row = allocation.allocations[index];
      const allocand = allocands[index];
      const ml = predictionByEmployee.get(employee.employeeId);

      if (!row || !allocand || !ml || row.employeeId !== employee.employeeId) {
        throw new DistributionInvariantError('error.distribution.allocationOrderMismatch');
      }

      const finalAmount = centsToDecimal(row.finalCents);
      const rawAmount = roundMoney(row.rawAmount);
      const minAmount = roundMoney(input.config.minimumPerHour.mul(employee.hoursWorked));

      const base = this.buildBaseExplanation({
        config: input.config,
        scoreShare: row.scoreShare,
        rawAmount,
        capCents: allocation.capCents,
        minimumAmount: minAmount,
        capApplied: row.capApplied,
        minimumApplied: row.minimumApplied,
        finalCents: row.finalCents,
      });

      const explanation =
        mode === 'ML_FULL'
          ? ({
              ...base,
              source: 'ML_FULL',
              modelVersion: prediction.modelVersion,
              mlWeight: decimalToJson(ml.weight),
              mlShare: decimalToJson(ml.share),
            } satisfies MlFullExplanation)
          : ({
              ...base,
              source: 'ML_ASSISTED',
              modelVersion: prediction.modelVersion,
              mlWeight: decimalToJson(ml.weight),
              mlShare: decimalToJson(ml.share),
              rulesShare: decimalToJson(
                this.requireRulesShare(employee.employeeId, rulesShareByEmployee),
              ),
              blendAlpha: decimalToJson(alpha),
            } satisfies MlAssistedExplanation);

      return {
        employeeId: employee.employeeId,
        amount: finalAmount,
        // weight actually used for the split (raw ML weight, or blended share)
        contributionScore: allocand.weight.toDecimalPlaces(4),
        explanation,
      };
    });

    const computationMethod =
      mode === 'ML_FULL' ? ComputationMethod.ML_FULL : ComputationMethod.ML_ASSISTED;

    return this.finalize(input, computationMethod, totalAmount, results);
  }

  private blendShare(
    employeeId: EmployeeId,
    mlShare: Prisma.Decimal,
    rulesShareByEmployee: ReadonlyMap<EmployeeId, Prisma.Decimal> | undefined,
    alpha: Prisma.Decimal,
  ): Prisma.Decimal {
    const rulesShare = this.requireRulesShare(employeeId, rulesShareByEmployee);

    return alpha.mul(mlShare).add(toDecimal(1).sub(alpha).mul(rulesShare));
  }

  private buildBaseExplanation(input: BaseExplanationInput) {
    return {
      schemaVersion: DISTRIBUTION_EXPLANATION_SCHEMA_VERSION,
      engineVersion: DISTRIBUTION_ENGINE_VERSION,
      policyVersion: input.config.policyVersion,
      scoreShare: decimalToJson(input.scoreShare),
      rawAmount: moneyToJson(input.rawAmount),
      capAmount: moneyToJson(centsToDecimal(input.capCents)),
      minAmount: moneyToJson(input.minimumAmount),
      capApplied: input.capApplied,
      minimumApplied: input.minimumApplied,
      roundingAdjustmentCents: input.finalCents - toCents(input.rawAmount),
      finalAmount: moneyToJson(centsToDecimal(input.finalCents)),
    } as const;
  }

  private finalize(
    input: DistributionInput,
    computationMethod: ComputationMethod,
    totalAmount: Prisma.Decimal,
    results: readonly DistributionResult[],
  ): DistributionComputationResult {
    if (results.length !== input.employees.length) {
      throw new DistributionInvariantError('error.distribution.resultRosterMismatch');
    }

    const distributedAmount = sumDecimals(results.map((result) => result.amount));

    assertPoolIntegrity(distributedAmount, totalAmount);

    const remainderCents = toCents(totalAmount) - toCents(distributedAmount);

    if (remainderCents !== 0) {
      throw new DistributionInvariantError('error.distribution.remainderNotZero');
    }

    return {
      tenantId: input.tenantId,
      tipPoolId: input.tipPoolId,
      shiftId: input.shiftId,
      computationMethod,
      totalAmount,
      distributedAmount,
      remainderCents: 0,
      results,
    };
  }

  // Rules scoreShare per employee for the ML_ASSISTED blend. Mirrors
  // allocateProportional's own degenerate handling: when the total rules score is
  // non-positive, fall back to the equal-by-hours share so the blend stays defined.
  private computeRulesShares(input: DistributionInput): ReadonlyMap<EmployeeId, Prisma.Decimal> {
    const scored = computeScores(input.employees, input.config);
    const totalScore = sumDecimals(scored.map((row) => row.rawScore));
    const totalHours = sumDecimals(input.employees.map((employee) => employee.hoursWorked));

    if (totalHours.lte(0)) {
      throw new DistributionInputError('error.distribution.invalidTotalHours');
    }

    return new Map(
      scored.map((row) => {
        const share = totalScore.gt(0)
          ? row.rawScore.div(totalScore)
          : row.input.hoursWorked.div(totalHours);

        return [row.input.employeeId, share];
      }),
    );
  }

  private validateAndIndexPrediction(
    input: DistributionInput,
    prediction: MlPrediction,
  ): ReadonlyMap<EmployeeId, MlWeightInput> {
    // Aligned with ml-client's wire schema, which allows model_version 0 (cold start).
    if (!Number.isSafeInteger(prediction.modelVersion) || prediction.modelVersion < 0) {
      throw new DistributionInputError('error.distribution.invalidModelVersion');
    }

    if (prediction.weights.length !== input.employees.length) {
      throw new DistributionInputError('error.distribution.mlPredictionRosterMismatch');
    }

    const predictionByEmployee = new Map<EmployeeId, MlWeightInput>();
    let shareSum = toDecimal(0);

    for (const weight of prediction.weights) {
      if (predictionByEmployee.has(weight.employeeId)) {
        throw new DistributionInputError('error.distribution.mlPredictionDuplicateEmployee');
      }

      if (!isDecimal(weight.weight) || !isDecimal(weight.share)) {
        throw new DistributionInputError('error.distribution.mlPredictionInvalidWeight');
      }

      if (weight.weight.lt(0) || weight.weight.gt(MAX_ML_WEIGHT)) {
        throw new DistributionInputError('error.distribution.mlPredictionInvalidWeight');
      }

      if (weight.share.lt(0) || weight.share.gt(1)) {
        throw new DistributionInputError('error.distribution.mlPredictionInvalidShare');
      }

      predictionByEmployee.set(weight.employeeId, weight);
      shareSum = shareSum.add(weight.share);
    }

    if (shareSum.sub(1).abs().gt(SHARE_SUM_TOLERANCE)) {
      throw new DistributionInputError('error.distribution.mlPredictionShareSumInvalid');
    }

    for (const employee of input.employees) {
      if (!predictionByEmployee.has(employee.employeeId)) {
        throw new DistributionInputError('error.distribution.mlPredictionMissingEmployee');
      }
    }

    return predictionByEmployee;
  }

  private validateInput(input: DistributionInput): void {
    if (!input.tenantId) {
      throw new DistributionInputError('error.distribution.missingTenantId');
    }

    if (!input.shiftId) {
      throw new DistributionInputError('error.distribution.missingShiftId');
    }

    if (!input.tipPoolId) {
      throw new DistributionInputError('error.distribution.missingTipPoolId');
    }

    if (!input.config) {
      throw new DistributionInputError('error.distribution.missingConfig');
    }

    if (!Array.isArray(input.employees) || input.employees.length === 0) {
      throw new DistributionInputError('error.distribution.noEmployees');
    }

    if (input.employees.length > MAX_EMPLOYEES_PER_DISTRIBUTION) {
      throw new DistributionInputError('error.distribution.tooManyEmployees');
    }

    if (!isDecimal(input.totalAmount) || input.totalAmount.lte(0)) {
      throw new DistributionInputError('error.distribution.invalidTotalAmount');
    }

    this.validateConfig(input.config);

    const uniqueEmployeeIds = new Set<string>();

    for (const employee of input.employees) {
      if (!employee.employeeId) {
        throw new DistributionInputError('error.distribution.missingEmployeeId');
      }

      if (uniqueEmployeeIds.has(employee.employeeId)) {
        throw new DistributionInputError('error.distribution.duplicateEmployee');
      }

      uniqueEmployeeIds.add(employee.employeeId);

      if (!isDecimal(employee.hoursWorked) || employee.hoursWorked.lte(0)) {
        throw new DistributionInputError('error.distribution.invalidHoursWorked');
      }

      if (!isDecimal(employee.salesGenerated) || employee.salesGenerated.lt(0)) {
        throw new DistributionInputError('error.distribution.invalidSalesGenerated');
      }

      if (!isDecimal(employee.coefficient) || employee.coefficient.lte(0)) {
        throw new DistributionInputError('error.distribution.invalidEmployeeCoefficient');
      }

      const roleCoefficient =
        input.config.roleCoefficients[employee.role as keyof typeof input.config.roleCoefficients];

      if (!isDecimal(roleCoefficient) || roleCoefficient.lte(0)) {
        throw new DistributionInputError('error.distribution.invalidRoleCoefficient');
      }
    }
  }

  private validateConfig(config: DistributionConfig): void {
    if (!config.policyVersion || config.policyVersion.trim().length === 0) {
      throw new DistributionInputError('error.distribution.missingPolicyVersion');
    }

    if (!isDecimal(config.minimumPerHour) || config.minimumPerHour.lt(0)) {
      throw new DistributionInputError('error.distribution.invalidMinimumPerHour');
    }

    if (
      !isDecimal(config.maxSharePercent) ||
      config.maxSharePercent.lte(0) ||
      config.maxSharePercent.gt(100)
    ) {
      throw new DistributionInputError('error.distribution.invalidMaxSharePercent');
    }

    if (!isDecimal(config.salesBonusWeight) || config.salesBonusWeight.lt(0)) {
      throw new DistributionInputError('error.distribution.invalidSalesBonusWeight');
    }
  }

  private requireRulesShare(
    employeeId: EmployeeId,
    rulesShareByEmployee: ReadonlyMap<EmployeeId, Prisma.Decimal> | undefined,
  ): Prisma.Decimal {
    const share = rulesShareByEmployee?.get(employeeId);

    if (!share) {
      throw new DistributionInvariantError('error.distribution.rulesShareMissingEmployee');
    }

    return share;
  }

  // Seam for a future per-tenant alpha; returns the documented V2 constant for now.
  private getMlAssistedAlpha(): Prisma.Decimal {
    return DEFAULT_ML_ASSISTED_ALPHA;
  }
}

function isDecimal(value: unknown): value is Prisma.Decimal {
  return value instanceof Prisma.Decimal;
}
