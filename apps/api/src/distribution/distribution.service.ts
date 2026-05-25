import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComputationMethod, OrderStatus, Prisma, ShiftStatus, TipPoolStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { DistributionCalculatorService } from './distribution-calculator/distribution-calculator.service';
import { DistributionInput, EmployeeShiftInput } from './distribution.types';
import { mapDistributionConfigFromPrisma } from './distribution.mapper';
import { DEFAULT_ROLE_COEFFICIENTS } from './distribution.types';
import { toDecimal } from './distribution-calculator/money';

@Injectable()
export class DistributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: DistributionCalculatorService,
  ) {}

  async distribute(tenantId: string, shiftId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findFirst({
        where: {
          id: shiftId,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          tipPool: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
            },
          },
          assignments: {
            where: {
              tenantId,
              deletedAt: null,
            },
            select: {
              id: true,
              employeeId: true,
              roleDuringShift: true,
              scheduledHours: true,
              hoursWorked: true,
              employee: {
                select: {
                  id: true,
                  role: true,
                  coefficient: true,
                  active: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      });

      if (!shift) {
        throw new NotFoundException('error.distribution.shiftNotFound');
      }

      if (shift.status !== ShiftStatus.CLOSED) {
        throw new BadRequestException('error.distribution.shiftNotClosed');
      }

      if (!shift.tipPool) {
        throw new BadRequestException('error.distribution.noTipPool');
      }

      if (shift.tipPool.status !== TipPoolStatus.DECLARED) {
        throw new BadRequestException('error.distribution.tipPoolNotDeclared');
      }

      if (shift.assignments.length === 0) {
        throw new BadRequestException('error.distribution.noAssignments');
      }

      const existingDistributions = await tx.tipDistribution.count({
        where: {
          tenantId,
          tipPoolId: shift.tipPool.id,
          deletedAt: null,
        },
      });

      if (existingDistributions > 0) {
        throw new ConflictException('error.distribution.alreadyExists');
      }

      const config = await this.resolveConfig(tx, tenantId);

      const salesByEmployeeId = await this.getSalesByEmployeeId(tx, tenantId, shiftId);

      const employees = this.mapEmployeeInputs(shift.assignments, salesByEmployeeId);

      const input: DistributionInput = {
        tenantId,
        shiftId,
        tipPoolId: shift.tipPool.id,
        totalAmount: shift.tipPool.totalAmount,
        config,
        employees,
        computationMethod: ComputationMethod.RULES,
      };

      const result = this.calculator.compute(input);

      const updateResult = await tx.tipPool.updateMany({
        where: {
          id: shift.tipPool.id,
          tenantId,
          deletedAt: null,
          status: TipPoolStatus.DECLARED,
        },
        data: {
          status: TipPoolStatus.DISTRIBUTED,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('error.distribution.concurrentDistribution');
      }

      await tx.tipDistribution.createMany({
        data: result.results.map((distribution) => ({
          tenantId,
          tipPoolId: shift.tipPool!.id,
          employeeId: distribution.employeeId,
          amount: distribution.amount,
          contributionScore: distribution.contributionScore,
          featuresSnapshot: this.toJsonValue(
            this.buildFeaturesSnapshot(
              employees.find((employee) => employee.employeeId === distribution.employeeId),
            ),
          ),
          explanation: this.toJsonValue(distribution.explanation),
          computationMethod: ComputationMethod.RULES,
        })),
      });
    });
  }

  async getDistribution(tenantId: string, shiftId: string) {
    const tipPool = await this.prisma.tipPool.findFirst({
      where: {
        tenantId,
        shiftId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!tipPool) {
      throw new NotFoundException('error.distribution.tipPoolNotFound');
    }

    const distributions = await this.prisma.tipDistribution.findMany({
      where: {
        tenantId,
        tipPoolId: tipPool.id,
        deletedAt: null,
      },
      select: {
        id: true,
        employeeId: true,
        amount: true,
        contributionScore: true,
        featuresSnapshot: true,
        explanation: true,
        computationMethod: true,
        acknowledgedAt: true,
        paidAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        amount: 'desc',
      },
    });

    if (distributions.length === 0) {
      throw new NotFoundException('error.distribution.notFound');
    }

    return distributions;
  }

  private async resolveConfig(tx: Prisma.TransactionClient, tenantId: string) {
    const config = await tx.distributionConfig.findUnique({
      where: {
        tenantId,
      },
      select: {
        roleCoefficients: true,
        minPerHour: true,
        maxSharePct: true,
        salesBonusWeight: true,
      },
    });

    if (!config) {
      return this.getDefaultConfig();
    }

    return mapDistributionConfigFromPrisma(config);
  }

  private getDefaultConfig() {
    return {
      roleCoefficients: DEFAULT_ROLE_COEFFICIENTS,
      minimumPerHour: toDecimal(2),
      maxSharePercent: toDecimal(35),
      salesBonusWeight: toDecimal(0.5),
    };
  }

  private async getSalesByEmployeeId(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shiftId: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const groupedSales = await tx.order.groupBy({
      by: ['serverId'],
      where: {
        tenantId,
        shiftId,
        deletedAt: null,
        status: OrderStatus.PAID,
      },
      _sum: {
        totalAmount: true,
      },
    });

    return new Map(groupedSales.map((row) => [row.serverId, row._sum.totalAmount ?? toDecimal(0)]));
  }

  private mapEmployeeInputs(
    assignments: Array<{
      employeeId: string;
      roleDuringShift: EmployeeShiftInput['role'];
      scheduledHours: Prisma.Decimal;
      hoursWorked: Prisma.Decimal | null;
      employee: {
        id: string;
        coefficient: Prisma.Decimal;
        active: boolean;
        deletedAt: Date | null;
      };
    }>,
    salesByEmployeeId: Map<string, Prisma.Decimal>,
  ): EmployeeShiftInput[] {
    return assignments.map((assignment) => {
      if (!assignment.employee.active || assignment.employee.deletedAt) {
        throw new BadRequestException('error.distribution.employeeInactive');
      }

      const effectiveHours = assignment.hoursWorked ?? assignment.scheduledHours;

      if (effectiveHours.lte(0)) {
        throw new BadRequestException('error.distribution.invalidHoursWorked');
      }

      return {
        employeeId: assignment.employeeId,
        role: assignment.roleDuringShift,
        hoursWorked: effectiveHours,
        salesGenerated: salesByEmployeeId.get(assignment.employeeId) ?? toDecimal(0),
        coefficient: assignment.employee.coefficient ?? toDecimal(1),
      };
    });
  }

  private buildFeaturesSnapshot(employee: EmployeeShiftInput | undefined): Prisma.InputJsonValue {
    if (!employee) {
      return {};
    }

    return {
      role: employee.role,
      hoursWorked: employee.hoursWorked.toString(),
      salesGenerated: employee.salesGenerated.toString(),
      coefficient: employee.coefficient.toString(),
    };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
