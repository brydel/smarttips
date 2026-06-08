import { Prisma } from '@prisma/client';

import {
  DISTRIBUTION_ENGINE_VERSION,
  DISTRIBUTION_EXPLANATION_SCHEMA_VERSION,
  DistributionConfig,
  DistributionExplanation,
  DistributionResult,
  EmployeeShiftInput,
  SALES_ELIGIBLE_ROLES,
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

const MAX_EMPLOYEES_PER_DISTRIBUTION = 500;
const MAX_POOL_CENTS = 100_000_000; // 1 000 000.00 $ per single distribution

// Framework-agnostic errors: this engine is pure money logic and must not depend
// on @nestjs/common HTTP semantics (it is reused by the ML orchestrator). The two
// classes encode HTTP intent without importing HTTP: InputError = client-fixable
// (-> 400), InvariantError = our bug, should be impossible (-> 500). The mapping
// lives in DistributionExceptionFilter, which MUST be registered or these surface
// as 500s. message is always an i18n key.
export class DistributionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DistributionInputError';
  }
}

export class DistributionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DistributionInvariantError';
  }
}

interface ScoredEmployee {
  readonly input: EmployeeShiftInput;
  readonly roleCoefficient: Prisma.Decimal;
  readonly baseScore: Prisma.Decimal;
  readonly rawScore: Prisma.Decimal;
  readonly shiftAvgSales: Prisma.Decimal;
  readonly salesBonus: Prisma.Decimal;
}

// Source-agnostic bounded allocator contract (rules rawScore, ML weight, or blend).
// Types are local for the duel; they relocate to distribution.types.ts later.
export interface WeightedAllocand {
  readonly employeeId: string;
  readonly weight: Prisma.Decimal;
  readonly minimumCents: number;
}

export interface BoundedAllocation {
  readonly employeeId: string;
  readonly finalCents: number;
  readonly scoreShare: Prisma.Decimal;
  readonly rawAmount: Prisma.Decimal;
  readonly capApplied: boolean;
  readonly minimumApplied: boolean;
}

export interface BoundedAllocationResult {
  readonly poolTotalRounded: Prisma.Decimal;
  readonly poolCents: number;
  readonly capCents: number;
  readonly totalWeight: Prisma.Decimal;
  readonly allocations: readonly BoundedAllocation[];
}

interface AllocationRow {
  readonly employeeId: string;
  readonly weight: Prisma.Decimal;
  readonly minimumCents: number;
  readonly originalIndex: number;
  readonly scoreShare: Prisma.Decimal;
  readonly rawAmount: Prisma.Decimal;
  readonly rawFloorCents: number;
  finalCents: number;
  capApplied: boolean;
  minimumApplied: boolean;
}

export function computeScores(
  employees: readonly EmployeeShiftInput[],
  config: DistributionConfig,
): ScoredEmployee[] {
  validateRoster(employees);

  const eligibleSales = employees
    .filter((employee) => SALES_ELIGIBLE_ROLES.has(employee.role))
    .map((employee) => employee.salesGenerated);

  const shiftAvgSales =
    eligibleSales.length > 0 ? sumDecimals(eligibleSales).div(eligibleSales.length) : toDecimal(0);

  return employees.map((employee) => {
    if (employee.hoursWorked.lte(0)) {
      throw new DistributionInputError('error.distribution.invalidHoursWorked');
    }

    if (employee.salesGenerated.lt(0)) {
      throw new DistributionInputError('error.distribution.invalidSalesGenerated');
    }

    if (employee.coefficient.lte(0)) {
      throw new DistributionInputError('error.distribution.invalidEmployeeCoefficient');
    }

    const roleCoefficient = config.roleCoefficients[employee.role];

    if (!roleCoefficient || roleCoefficient.lte(0)) {
      throw new DistributionInputError('error.distribution.invalidRoleCoefficient');
    }

    const isSalesEligible = SALES_ELIGIBLE_ROLES.has(employee.role);

    const aboveAverageRatio =
      isSalesEligible && shiftAvgSales.gt(0) && employee.salesGenerated.gt(shiftAvgSales)
        ? employee.salesGenerated.sub(shiftAvgSales).div(shiftAvgSales)
        : toDecimal(0);

    const salesBonus = toDecimal(1).add(
      aboveAverageRatio.mul(config.salesBonusWeight ?? toDecimal(0)),
    );

    const baseScore = employee.hoursWorked.mul(roleCoefficient).mul(employee.coefficient);
    const rawScore = baseScore.mul(salesBonus);

    return {
      input: employee,
      roleCoefficient,
      baseScore,
      rawScore,
      shiftAvgSales,
      salesBonus,
    };
  });
}

// THE ENGINE. Pure bounded Hamilton allocator over arbitrary weights.
// Guarantees: minimumCents <= finalCents <= capCents, proportional to weight,
// fractional cents by largest remainder with deterministic employeeId tiebreak,
// and Sum(finalCents) === poolCents exactly. Assumes totalWeight > 0; callers
// route the all-zero-weight case to their own fallback.
export function allocateBounded(
  allocands: readonly WeightedAllocand[],
  poolTotal: Prisma.Decimal,
  config: DistributionConfig,
): BoundedAllocationResult {
  validateAllocands(allocands);

  if (poolTotal.lte(0)) {
    throw new DistributionInputError('error.distribution.totalAmountMustBePositive');
  }

  const poolTotalRounded = roundMoney(poolTotal);
  const poolCents = toCents(poolTotalRounded);

  if (!Number.isSafeInteger(poolCents) || poolCents <= 0 || poolCents > MAX_POOL_CENTS) {
    throw new DistributionInputError('error.distribution.invalidPoolCents');
  }

  const totalWeight = sumDecimals(allocands.map((allocand) => allocand.weight));

  if (totalWeight.lte(0)) {
    throw new DistributionInputError('error.distribution.invalidWeights');
  }

  const capCents = calculateCapCents(poolCents, config.maxSharePercent);

  if (capCents <= 0) {
    throw new DistributionInputError('error.distribution.invalidCap');
  }

  if (capCents * allocands.length < poolCents) {
    throw new DistributionInputError('error.distribution.capPreventsFullAllocation');
  }

  const totalMinimumCents = allocands.reduce((sum, allocand) => {
    if (allocand.minimumCents > capCents) {
      throw new DistributionInputError('error.distribution.minimumExceedsCap');
    }

    return sum + allocand.minimumCents;
  }, 0);

  if (totalMinimumCents > poolCents) {
    throw new DistributionInputError('error.distribution.minimumPoolInsufficient');
  }

  const rows = allocands.map((allocand, index): AllocationRow => {
    const scoreShare = allocand.weight.div(totalWeight);
    const rawAmount = poolTotalRounded.mul(scoreShare);
    const rawFloorCents = decimalFloorToSafeInteger(rawAmount.mul(100));

    return {
      employeeId: allocand.employeeId,
      weight: allocand.weight,
      minimumCents: allocand.minimumCents,
      originalIndex: index,
      scoreShare,
      rawAmount,
      rawFloorCents,
      finalCents: allocand.minimumCents,
      capApplied: false,
      minimumApplied: rawFloorCents < allocand.minimumCents,
    };
  });

  distributeRemainder(rows, poolCents, capCents);

  const allocatedCents = rows.reduce((sum, row) => sum + row.finalCents, 0);

  // Hard invariant: integer cents must sum to the pool exactly. If violated, it is
  // an engine bug, not bad client input -> InvariantError -> 500.
  if (allocatedCents !== poolCents) {
    throw new DistributionInvariantError('error.distribution.integrityViolation');
  }

  return {
    poolTotalRounded,
    poolCents,
    capCents,
    totalWeight,
    allocations: rows
      .slice()
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .map((row) => ({
        employeeId: row.employeeId,
        finalCents: row.finalCents,
        scoreShare: row.scoreShare,
        rawAmount: row.rawAmount,
        capApplied: row.capApplied || row.finalCents >= capCents,
        minimumApplied: row.minimumApplied,
      })),
  };
}

// RULES path. Thin wrapper: rawScore as weight -> engine -> rich rules explanation.
// Behavior is identical to the pre-refactor allocateProportional (both branches).
export function allocateProportional(
  scored: readonly ScoredEmployee[],
  poolTotal: Prisma.Decimal,
  config: DistributionConfig,
): DistributionResult[] {
  if (scored.length === 0) {
    throw new DistributionInputError('error.distribution.noEmployees');
  }

  if (poolTotal.lte(0)) {
    throw new DistributionInputError('error.distribution.totalAmountMustBePositive');
  }

  const totalScore = sumDecimals(scored.map((row) => row.rawScore));

  // Degenerate all-zero-score case keeps its original behavior (equal-by-hours, no
  // min/cap). Applying min/cap here too is a worthwhile but separate change.
  if (totalScore.lte(0)) {
    return fallbackEqualByHours(
      scored.map((row) => row.input),
      roundMoney(poolTotal),
      config.policyVersion,
    );
  }

  const allocands = scored.map(
    (row): WeightedAllocand => ({
      employeeId: row.input.employeeId,
      weight: row.rawScore,
      minimumCents: toCents(config.minimumPerHour.mul(row.input.hoursWorked)),
    }),
  );

  const result = allocateBounded(allocands, poolTotal, config);
  const results = buildRulesResults(scored, result, config);

  const distributed = sumDecimals(results.map((row) => row.amount));
  assertPoolIntegrity(distributed, result.poolTotalRounded);

  return results;
}

function distributeRemainder(rows: AllocationRow[], poolCents: number, capCents: number): void {
  let remainingCents = poolCents - rows.reduce((sum, row) => sum + row.finalCents, 0);

  if (remainingCents < 0) {
    throw new DistributionInvariantError('error.distribution.negativeRemainder');
  }

  while (remainingCents > 0) {
    // ALL rows still under cap are eligible — including zero-weight ones, so a pool
    // that is allocatable is never falsely rejected when positive-weight rows cap out.
    const activeRows = rows.filter((row) => row.finalCents < capCents);

    if (activeRows.length === 0) {
      throw new DistributionInputError('error.distribution.capPreventsFullAllocation');
    }

    const totalActiveWeight = sumDecimals(activeRows.map((row) => row.weight));

    if (totalActiveWeight.lte(0)) {
      // Only zero-weight rows remain under cap: distribute one cent at a time,
      // deterministic by employeeId.
      distributeOneCentAtATime(activeRows, remainingCents, capCents);
      remainingCents = poolCents - rows.reduce((sum, row) => sum + row.finalCents, 0);
      continue;
    }

    const candidates = activeRows.map((row) => {
      const idealAdditional = new Prisma.Decimal(remainingCents)
        .mul(row.weight)
        .div(totalActiveWeight);

      const floorAdditional = Math.max(0, decimalFloorToSafeInteger(idealAdditional));
      const capacity = capCents - row.finalCents;
      const additionalCents = Math.min(floorAdditional, capacity);

      return {
        row,
        additionalCents,
        fractionalRemainder: idealAdditional.sub(floorAdditional),
      };
    });

    let distributedThisPass = 0;

    for (const candidate of candidates) {
      if (candidate.additionalCents <= 0) {
        continue;
      }

      candidate.row.finalCents += candidate.additionalCents;
      distributedThisPass += candidate.additionalCents;

      if (candidate.row.finalCents >= capCents) {
        candidate.row.capApplied = true;
      }
    }

    remainingCents -= distributedThisPass;

    if (remainingCents <= 0) {
      break;
    }

    const remainderCandidates = candidates
      .filter((candidate) => candidate.row.finalCents < capCents)
      .sort((a, b) => {
        const fractionComparison = b.fractionalRemainder.comparedTo(a.fractionalRemainder);

        if (fractionComparison !== 0) {
          return fractionComparison;
        }

        return a.row.employeeId.localeCompare(b.row.employeeId);
      });

    if (remainderCandidates.length === 0) {
      throw new DistributionInputError('error.distribution.capPreventsFullAllocation');
    }

    for (const candidate of remainderCandidates) {
      if (remainingCents <= 0) {
        break;
      }

      candidate.row.finalCents += 1;
      remainingCents -= 1;

      if (candidate.row.finalCents >= capCents) {
        candidate.row.capApplied = true;
      }
    }
  }
}

function distributeOneCentAtATime(
  rows: AllocationRow[],
  remainingCents: number,
  capCents: number,
): void {
  const sortedRows = [...rows].sort((a, b) => a.employeeId.localeCompare(b.employeeId));

  let remaining = remainingCents;

  while (remaining > 0) {
    let allocated = false;

    for (const row of sortedRows) {
      if (remaining <= 0) {
        break;
      }

      if (row.finalCents >= capCents) {
        continue;
      }

      row.finalCents += 1;
      remaining -= 1;
      allocated = true;

      if (row.finalCents >= capCents) {
        row.capApplied = true;
      }
    }

    if (!allocated) {
      throw new DistributionInputError('error.distribution.capPreventsFullAllocation');
    }
  }
}

function buildRulesResults(
  scored: readonly ScoredEmployee[],
  result: BoundedAllocationResult,
  config: DistributionConfig,
): DistributionResult[] {
  const capAmount = centsToDecimal(result.capCents);

  return scored.map((row, index): DistributionResult => {
    const allocation = result.allocations[index];

    if (!allocation || allocation.employeeId !== row.input.employeeId) {
      throw new DistributionInvariantError('error.distribution.allocationOrderMismatch');
    }

    const finalAmount = centsToDecimal(allocation.finalCents);
    const rawAmount = roundMoney(allocation.rawAmount);
    const minAmount = roundMoney(config.minimumPerHour.mul(row.input.hoursWorked));

    const explanation: DistributionExplanation = {
      source: 'RULES',
      schemaVersion: DISTRIBUTION_EXPLANATION_SCHEMA_VERSION,
      engineVersion: DISTRIBUTION_ENGINE_VERSION,
      policyVersion: config.policyVersion,
      roleCoefficient: decimalToJson(row.roleCoefficient),
      employeeCoefficient: decimalToJson(row.input.coefficient),
      hoursWorked: decimalToJson(row.input.hoursWorked),
      salesGenerated: moneyToJson(row.input.salesGenerated),
      shiftAvgSales: moneyToJson(row.shiftAvgSales),
      salesBonus: decimalToJson(row.salesBonus),
      baseScore: decimalToJson(row.baseScore),
      rawScore: decimalToJson(row.rawScore),
      scoreShare: decimalToJson(allocation.scoreShare),
      rawAmount: moneyToJson(rawAmount),
      capAmount: moneyToJson(capAmount),
      minAmount: moneyToJson(minAmount),
      capApplied: allocation.capApplied,
      minimumApplied: allocation.minimumApplied,
      roundingAdjustmentCents: allocation.finalCents - toCents(rawAmount),
      finalAmount: moneyToJson(finalAmount),
    };

    return {
      employeeId: row.input.employeeId,
      amount: finalAmount,
      contributionScore: row.rawScore.toDecimalPlaces(4),
      explanation,
    };
  });
}

export function calculateCapCents(poolCents: number, maxSharePercent: Prisma.Decimal): number {
  if (!Number.isSafeInteger(poolCents) || poolCents <= 0 || poolCents > MAX_POOL_CENTS) {
    throw new DistributionInputError('error.distribution.invalidPoolCents');
  }

  if (maxSharePercent.lte(0) || maxSharePercent.gt(100)) {
    throw new DistributionInputError('error.distribution.invalidMaxSharePercent');
  }

  return decimalFloorToSafeInteger(new Prisma.Decimal(poolCents).mul(maxSharePercent).div(100));
}

export function fallbackEqualByHours(
  employees: readonly EmployeeShiftInput[],
  poolTotal: Prisma.Decimal,
  policyVersion: string,
): DistributionResult[] {
  validateRoster(employees);

  const totalHours = sumDecimals(employees.map((employee) => employee.hoursWorked));

  if (totalHours.lte(0)) {
    throw new DistributionInputError('error.distribution.invalidTotalHours');
  }

  const poolTotalRounded = roundMoney(poolTotal);
  const poolCents = toCents(poolTotalRounded);

  const rows = employees.map((employee) => {
    const rawAmount = poolTotalRounded.mul(employee.hoursWorked.div(totalHours));
    const rawCents = rawAmount.mul(100);
    const floorCents = decimalFloorToSafeInteger(rawCents);

    return {
      employee,
      rawAmount,
      floorCents,
      fractionalRemainder: rawCents.sub(floorCents),
      finalCents: floorCents,
    };
  });

  let remainingCents = poolCents - rows.reduce((sum, row) => sum + row.finalCents, 0);

  const priorityRows = [...rows].sort((a, b) => {
    const fractionComparison = b.fractionalRemainder.comparedTo(a.fractionalRemainder);

    if (fractionComparison !== 0) {
      return fractionComparison;
    }

    return a.employee.employeeId.localeCompare(b.employee.employeeId);
  });

  for (const row of priorityRows) {
    if (remainingCents <= 0) {
      break;
    }

    row.finalCents += 1;
    remainingCents -= 1;
  }

  if (remainingCents !== 0) {
    throw new DistributionInvariantError('error.distribution.integrityViolation');
  }

  const results = rows.map((row): DistributionResult => {
    const finalAmount = centsToDecimal(row.finalCents);

    return {
      employeeId: row.employee.employeeId,
      amount: finalAmount,
      contributionScore: toDecimal(0),
      explanation: {
        source: 'RULES',
        schemaVersion: DISTRIBUTION_EXPLANATION_SCHEMA_VERSION,
        engineVersion: DISTRIBUTION_ENGINE_VERSION,
        policyVersion,
        roleCoefficient: '0.0000',
        employeeCoefficient: decimalToJson(row.employee.coefficient),
        hoursWorked: decimalToJson(row.employee.hoursWorked),
        salesGenerated: moneyToJson(row.employee.salesGenerated),
        shiftAvgSales: '0.00',
        salesBonus: '1.0000',
        baseScore: '0.0000',
        rawScore: '0.0000',
        scoreShare: decimalToJson(row.employee.hoursWorked.div(totalHours)),
        rawAmount: moneyToJson(roundMoney(row.rawAmount)),
        capAmount: '0.00',
        minAmount: '0.00',
        capApplied: false,
        minimumApplied: false,
        roundingAdjustmentCents: row.finalCents - toCents(roundMoney(row.rawAmount)),
        finalAmount: moneyToJson(finalAmount),
      },
    };
  });

  const distributed = sumDecimals(results.map((result) => result.amount));
  assertPoolIntegrity(distributed, poolTotalRounded);

  return results;
}

// UUID FORMAT is intentionally NOT validated here: it is a boundary concern handled
// by ParseUUIDPipe at the controller. The engine only enforces uniqueness, which is
// a real domain invariant (the same employee must not appear twice in one pool).
function validateRoster(employees: readonly EmployeeShiftInput[]): void {
  assertCardinality(employees.length);
  assertNoDuplicateIds(employees.map((employee) => employee.employeeId));
}

function validateAllocands(allocands: readonly WeightedAllocand[]): void {
  assertCardinality(allocands.length);
  assertNoDuplicateIds(allocands.map((allocand) => allocand.employeeId));

  for (const allocand of allocands) {
    if (allocand.weight.lt(0)) {
      throw new DistributionInputError('error.distribution.invalidWeights');
    }

    if (!Number.isSafeInteger(allocand.minimumCents) || allocand.minimumCents < 0) {
      throw new DistributionInputError('error.distribution.invalidMinimum');
    }
  }
}

function assertCardinality(count: number): void {
  if (count === 0) {
    throw new DistributionInputError('error.distribution.noEmployees');
  }

  if (count > MAX_EMPLOYEES_PER_DISTRIBUTION) {
    throw new DistributionInputError('error.distribution.tooManyEmployees');
  }
}

function assertNoDuplicateIds(ids: readonly string[]): void {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new DistributionInputError('error.distribution.duplicateEmployeeId');
    }

    seen.add(id);
  }
}

function decimalFloorToSafeInteger(value: Prisma.Decimal): number {
  const integer = Number(value.floor().toFixed(0));

  if (!Number.isSafeInteger(integer)) {
    throw new DistributionInputError('error.distribution.numberOutOfSafeRange');
  }

  return integer;
}
