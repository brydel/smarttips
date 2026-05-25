import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DistributionComputationResult, DistributionInput } from '../distribution.types';
import { assertPoolIntegrity, roundMoney, sumDecimals, toCents } from './money';
import { allocateProportional, computeScores } from './allocation';

@Injectable()
export class DistributionCalculatorService {
  compute(input: DistributionInput): DistributionComputationResult {
    this.validateInput(input);

    const totalAmount = roundMoney(input.totalAmount);

    const scored = computeScores(input.employees, input.config);

    const results = allocateProportional(scored, totalAmount, input.config);

    const distributedAmount = sumDecimals(results.map((result) => result.amount));

    assertPoolIntegrity(distributedAmount, totalAmount);

    const remainderCents = toCents(totalAmount) - toCents(distributedAmount);

    if (remainderCents !== 0) {
      throw new BadRequestException('error.distribution.remainderNotZero');
    }

    return {
      totalAmount,
      distributedAmount,
      remainderCents,
      results,
    };
  }

  private validateInput(input: DistributionInput): void {
    if (!input.tenantId) {
      throw new BadRequestException('error.distribution.missingTenantId');
    }

    if (!input.shiftId) {
      throw new BadRequestException('error.distribution.missingShiftId');
    }

    if (!input.tipPoolId) {
      throw new BadRequestException('error.distribution.missingTipPoolId');
    }

    if (!input.config) {
      throw new BadRequestException('error.distribution.missingConfig');
    }

    if (!input.employees || input.employees.length === 0) {
      throw new BadRequestException('error.distribution.noEmployees');
    }

    if (!(input.totalAmount instanceof Prisma.Decimal)) {
      throw new BadRequestException('error.distribution.invalidTotalAmount');
    }

    if (input.totalAmount.lte(0)) {
      throw new BadRequestException('error.distribution.totalAmountMustBePositive');
    }

    if (input.config.minimumPerHour.lt(0)) {
      throw new BadRequestException('error.distribution.invalidMinimumPerHour');
    }

    if (input.config.maxSharePercent.lte(0) || input.config.maxSharePercent.gt(100)) {
      throw new BadRequestException('error.distribution.invalidMaxSharePercent');
    }

    if (input.config.salesBonusWeight.lt(0)) {
      throw new BadRequestException('error.distribution.invalidSalesBonusWeight');
    }

    const uniqueEmployeeIds = new Set<string>();

    for (const employee of input.employees) {
      if (!employee.employeeId) {
        throw new BadRequestException('error.distribution.missingEmployeeId');
      }

      if (uniqueEmployeeIds.has(employee.employeeId)) {
        throw new BadRequestException('error.distribution.duplicateEmployee');
      }

      uniqueEmployeeIds.add(employee.employeeId);

      if (employee.hoursWorked.lte(0)) {
        throw new BadRequestException('error.distribution.invalidHoursWorked');
      }

      if (employee.salesGenerated.lt(0)) {
        throw new BadRequestException('error.distribution.invalidSalesGenerated');
      }

      if (employee.coefficient.lte(0)) {
        throw new BadRequestException('error.distribution.invalidEmployeeCoefficient');
      }

      const roleCoefficient = input.config.roleCoefficients[employee.role];

      if (!roleCoefficient || roleCoefficient.lte(0)) {
        throw new BadRequestException('error.distribution.invalidRoleCoefficient');
      }
    }
  }
}
