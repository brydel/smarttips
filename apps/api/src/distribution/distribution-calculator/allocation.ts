import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
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

interface ScoredEmployee {
  input: EmployeeShiftInput;
  roleCoefficient: Prisma.Decimal;
  baseScore: Prisma.Decimal;
  rawScore: Prisma.Decimal;
  shiftAvgSales: Prisma.Decimal;
  salesBonus: Prisma.Decimal;
}

interface AllocationRow {
  scored: ScoredEmployee;
  rawAmount: Prisma.Decimal;
  floorCents: number;
  fractionalRemainder: Prisma.Decimal;
  finalCents: number;
  minimumCents: number;
  capApplied: boolean;
  minimumApplied: boolean;
}

export function computeScores(
  employees: EmployeeShiftInput[],
  config: DistributionConfig,
): ScoredEmployee[] {
  if (employees.length === 0) {
    throw new BadRequestException('error.distribution.noEmployees');
  }

  const eligibleSales = employees
    .filter((employee) => SALES_ELIGIBLE_ROLES.has(employee.role))
    .map((employee) => employee.salesGenerated);

  const shiftAvgSales =
    eligibleSales.length > 0 ? sumDecimals(eligibleSales).div(eligibleSales.length) : toDecimal(0);

  return employees.map((employee) => {
    if (employee.hoursWorked.lte(0)) {
      throw new BadRequestException('error.distribution.invalidHoursWorked');
    }

    if (employee.salesGenerated.lt(0)) {
      throw new BadRequestException('error.distribution.invalidSalesGenerated');
    }

    if (employee.coefficient.lte(0)) {
      throw new BadRequestException('error.distribution.invalidEmployeeCoefficient');
    }

    const roleCoefficient = config.roleCoefficients[employee.role];

    if (!roleCoefficient || roleCoefficient.lte(0)) {
      throw new BadRequestException('error.distribution.invalidRoleCoefficient');
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

export function allocateProportional(
  scored: ScoredEmployee[],
  poolTotal: Prisma.Decimal,
  config: DistributionConfig,
): DistributionResult[] {
  if (poolTotal.lte(0)) {
    throw new BadRequestException('error.distribution.totalAmountMustBePositive');
  }

  const poolTotalRounded = roundMoney(poolTotal);
  const poolCents = toCents(poolTotalRounded);
  const totalScore = sumDecimals(scored.map((row) => row.rawScore));

  if (totalScore.lte(0)) {
    return fallbackEqualByHours(
      scored.map((row) => row.input),
      poolTotalRounded,
    );
  }

  const capCents = calculateCapCents(poolCents, config.maxSharePercent);

  if (capCents <= 0) {
    throw new BadRequestException('error.distribution.invalidCap');
  }

  if (capCents * scored.length < poolCents) {
    throw new BadRequestException('error.distribution.capPreventsFullAllocation');
  }

  const rows = scored.map((row): AllocationRow => {
    const scoreShare = row.rawScore.div(totalScore);
    const rawAmount = poolTotalRounded.mul(scoreShare);
    const rawCents = rawAmount.mul(100);
    const floorCents = Math.floor(rawCents.toNumber());
    const minimumCents = toCents(config.minimumPerHour.mul(row.input.hoursWorked));

    if (minimumCents > capCents) {
      throw new BadRequestException('error.distribution.minimumExceedsCap');
    }

    return {
      scored: row,
      rawAmount,
      floorCents,
      fractionalRemainder: rawCents.sub(floorCents),
      finalCents: minimumCents,
      minimumCents,
      capApplied: false,
      minimumApplied: floorCents < minimumCents,
    };
  });

  const totalMinimumCents = rows.reduce((sum, row) => sum + row.minimumCents, 0);

  if (totalMinimumCents > poolCents) {
    throw new BadRequestException('error.distribution.minimumPoolInsufficient');
  }

  allocateWithBounds(rows, poolCents, capCents);

  const results = buildResults(rows, poolTotalRounded, totalScore, config, capCents);

  const distributed = sumDecimals(results.map((result) => result.amount));
  assertPoolIntegrity(distributed, poolTotalRounded);

  return results;
}

function allocateWithBounds(rows: AllocationRow[], poolCents: number, capCents: number): void {
  let remainingCents = poolCents - rows.reduce((sum, row) => sum + row.finalCents, 0);

  while (remainingCents > 0) {
    const activeRows = rows.filter((row) => row.finalCents < capCents);

    if (activeRows.length === 0) {
      throw new BadRequestException('error.distribution.capPreventsFullAllocation');
    }

    const totalActiveScore = sumDecimals(activeRows.map((row) => row.scored.rawScore));

    if (totalActiveScore.lte(0)) {
      distributeOneCentAtATime(activeRows, remainingCents, capCents);
      remainingCents = poolCents - rows.reduce((sum, row) => sum + row.finalCents, 0);
      continue;
    }

    const candidates = activeRows.map((row) => {
      const target = new Prisma.Decimal(remainingCents)
        .mul(row.scored.rawScore)
        .div(totalActiveScore);

      const floorAdd = Math.floor(target.toNumber());
      const capacity = capCents - row.finalCents;
      const add = Math.min(floorAdd, capacity);

      return {
        row,
        add,
        fraction: target.sub(floorAdd),
      };
    });

    let allocatedThisRound = 0;

    for (const candidate of candidates) {
      if (candidate.add > 0) {
        candidate.row.finalCents += candidate.add;
        allocatedThisRound += candidate.add;

        if (candidate.row.finalCents >= capCents) {
          candidate.row.capApplied = true;
        }
      }
    }

    remainingCents -= allocatedThisRound;

    if (remainingCents <= 0) {
      break;
    }

    const sortedByFraction = candidates
      .filter((candidate) => candidate.row.finalCents < capCents)
      .sort((a, b) => {
        const fractionComparison = b.fraction.comparedTo(a.fraction);

        if (fractionComparison !== 0) {
          return fractionComparison;
        }

        return a.row.scored.input.employeeId.localeCompare(b.row.scored.input.employeeId);
      });

    if (sortedByFraction.length === 0) {
      throw new BadRequestException('error.distribution.capPreventsFullAllocation');
    }

    let allocatedFractionalCent = false;

    for (const candidate of sortedByFraction) {
      if (remainingCents <= 0) {
        break;
      }

      candidate.row.finalCents += 1;
      remainingCents -= 1;
      allocatedFractionalCent = true;

      if (candidate.row.finalCents >= capCents) {
        candidate.row.capApplied = true;
      }
    }

    if (!allocatedFractionalCent) {
      throw new BadRequestException('error.distribution.capPreventsFullAllocation');
    }
  }

  for (const row of rows) {
    row.capApplied = row.capApplied || row.finalCents >= capCents;
  }
}

function distributeOneCentAtATime(
  rows: AllocationRow[],
  remainingCents: number,
  capCents: number,
): void {
  const sortedRows = [...rows].sort((a, b) =>
    a.scored.input.employeeId.localeCompare(b.scored.input.employeeId),
  );

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
      throw new BadRequestException('error.distribution.capPreventsFullAllocation');
    }
  }
}

function buildResults(
  rows: AllocationRow[],
  poolTotal: Prisma.Decimal,
  totalScore: Prisma.Decimal,
  config: DistributionConfig,
  capCents: number,
): DistributionResult[] {
  return rows.map((row) => {
    const finalAmount = centsToDecimal(row.finalCents);
    const scoreShare = row.scored.rawScore.div(totalScore);
    const rawAmount = roundMoney(row.rawAmount);
    const minAmount = roundMoney(config.minimumPerHour.mul(row.scored.input.hoursWorked));
    const capAmount = centsToDecimal(capCents);

    const explanation: DistributionExplanation = {
      roleCoefficient: decimalToJson(row.scored.roleCoefficient),
      employeeCoefficient: decimalToJson(row.scored.input.coefficient),
      hoursWorked: decimalToJson(row.scored.input.hoursWorked),
      salesGenerated: moneyToJson(row.scored.input.salesGenerated),
      shiftAvgSales: moneyToJson(row.scored.shiftAvgSales),
      salesBonus: decimalToJson(row.scored.salesBonus),
      baseScore: decimalToJson(row.scored.baseScore),
      rawScore: decimalToJson(row.scored.rawScore),
      scoreShare: decimalToJson(scoreShare),
      rawAmount: moneyToJson(rawAmount),
      capAmount: moneyToJson(capAmount),
      minAmount: moneyToJson(minAmount),
      capApplied: row.capApplied,
      minimumApplied: row.minimumApplied,
      roundingAdjustmentCents: row.finalCents - toCents(rawAmount),
      finalAmount: moneyToJson(finalAmount),
    };

    return {
      employeeId: row.scored.input.employeeId,
      amount: finalAmount,
      contributionScore: row.scored.rawScore.toDecimalPlaces(4),
      explanation,
    };
  });
}

function calculateCapCents(poolCents: number, maxSharePercent: Prisma.Decimal): number {
  if (maxSharePercent.lte(0) || maxSharePercent.gt(100)) {
    throw new BadRequestException('error.distribution.invalidMaxSharePercent');
  }

  return Math.floor(new Prisma.Decimal(poolCents).mul(maxSharePercent).div(100).toNumber());
}

export function fallbackEqualByHours(
  employees: EmployeeShiftInput[],
  poolTotal: Prisma.Decimal,
): DistributionResult[] {
  const totalHours = sumDecimals(employees.map((employee) => employee.hoursWorked));

  if (totalHours.lte(0)) {
    throw new BadRequestException('error.distribution.invalidTotalHours');
  }

  const poolTotalRounded = roundMoney(poolTotal);
  const poolCents = toCents(poolTotalRounded);

  const rows = employees.map((employee) => {
    const rawAmount = poolTotalRounded.mul(employee.hoursWorked.div(totalHours));
    const rawCents = rawAmount.mul(100);
    const floorCents = Math.floor(rawCents.toNumber());

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

  const results = rows.map((row): DistributionResult => {
    const finalAmount = centsToDecimal(row.finalCents);

    return {
      employeeId: row.employee.employeeId,
      amount: finalAmount,
      contributionScore: toDecimal(0),
      explanation: {
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
