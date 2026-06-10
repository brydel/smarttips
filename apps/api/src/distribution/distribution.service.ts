import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ComputationMethod, OrderStatus, Prisma, ShiftStatus, TipPoolStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  centsToDecimal,
  decimalToJson,
  moneyToJson,
  roundMoney,
  sumDecimals,
  toCents,
  toDecimal,
} from './distribution-calculator/money';
import { DistributionCalculatorService } from './distribution-calculator/distribution-calculator.service';
import {
  DistributionComputationResult,
  DistributionInput,
  DistributionResult,
  EmployeeShiftInput,
} from './distribution.types';
import { mapDistributionConfigFromPrisma } from './distribution.mapper';
import { DEFAULT_ROLE_COEFFICIENTS } from './distribution.types';
import { DistributionMlClient, MlDistributionPredictResult } from './distribution-ml.client';

interface SalesStats {
  salesByEmployeeId: Map<string, Prisma.Decimal>;
  ordersByEmployeeId: Map<string, number>;
  totalSales: Prisma.Decimal;
}

interface MlShiftContext {
  id: string;
  date: Date;
  shiftType: string;
  startTime: Date;
  endTime: Date;
  actualEndTime: Date | null;
}

interface ComputedDistribution {
  result: DistributionComputationResult;
  computationMethod: ComputationMethod;
  mlModelVersion?: number;
}

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: DistributionCalculatorService,
    private readonly mlClient: DistributionMlClient,
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
          date: true,
          shiftType: true,
          startTime: true,
          endTime: true,
          actualEndTime: true,
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

      const salesStats = await this.getSalesStats(tx, tenantId, shiftId);

      const employees = this.mapEmployeeInputs(shift.assignments, salesStats.salesByEmployeeId);

      const input: DistributionInput = {
        tenantId,
        shiftId,
        tipPoolId: shift.tipPool.id,
        totalAmount: shift.tipPool.totalAmount,
        config,
        employees,
        computationMethod: ComputationMethod.RULES,
      };

      const computed = await this.computeDistribution(input, shift, salesStats);

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
        data: computed.result.results.map((distribution) => ({
          tenantId,
          tipPoolId: shift.tipPool!.id,
          employeeId: distribution.employeeId,
          amount: distribution.amount,
          contributionScore: distribution.contributionScore,
          featuresSnapshot: this.toJsonValue(
            this.buildFeaturesSnapshot(
              employees.find((employee) => employee.employeeId === distribution.employeeId),
              computed,
            ),
          ),
          explanation: this.toJsonValue(distribution.explanation),
          computationMethod: computed.computationMethod,
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

  private async computeDistribution(
    input: DistributionInput,
    shift: MlShiftContext,
    salesStats: SalesStats,
  ): Promise<ComputedDistribution> {
    if (this.mlClient.isConfigured()) {
      try {
        const mlResult = await this.mlClient.predictDistribution({
          tenantId: input.tenantId,
          shiftId: input.shiftId,
          poolCents: toCents(input.totalAmount),
          employees: this.buildMlEmployeeInputs(input, shift, salesStats),
        });

        if (mlResult) {
          return this.buildMlComputation(input, salesStats, mlResult);
        }
      } catch (error) {
        this.logger.warn('distribution_ml_fallback_to_rules', {
          tenantId: input.tenantId,
          shiftId: input.shiftId,
          errorType: error instanceof Error ? error.name : typeof error,
          safeMessage: error instanceof Error ? error.message : 'error.mlDistribution.unknown',
        });
      }
    }

    return {
      result: this.calculator.compute(input),
      computationMethod: ComputationMethod.RULES,
    };
  }

  private buildMlEmployeeInputs(
    input: DistributionInput,
    shift: MlShiftContext,
    salesStats: SalesStats,
  ) {
    const employeeCount = input.employees.length;
    const endTime = shift.actualEndTime ?? shift.endTime;

    return input.employees.map((employee) => ({
      employeeId: employee.employeeId,
      role: employee.role,
      shiftType: shift.shiftType,
      dayOfWeek: shift.date.getUTCDay(),
      hourStart: shift.startTime.getUTCHours(),
      hourEnd: endTime.getUTCHours(),
      employeeCount,
      salesTotalCents: toCents(salesStats.totalSales),
      assignedSalesCents: toCents(employee.salesGenerated),
      ordersCount: salesStats.ordersByEmployeeId.get(employee.employeeId) ?? 0,
    }));
  }

  private buildMlComputation(
    input: DistributionInput,
    salesStats: SalesStats,
    mlResult: MlDistributionPredictResult,
  ): ComputedDistribution {
    const allocationsByEmployeeId = new Map(
      mlResult.allocations.map((row) => [row.employeeId, row]),
    );
    const averageSales =
      input.employees.length > 0 ? salesStats.totalSales.div(input.employees.length) : toDecimal(0);

    const results = input.employees.map((employee): DistributionResult => {
      const allocation = allocationsByEmployeeId.get(employee.employeeId);

      if (!allocation) {
        throw new BadRequestException('error.distribution.mlAllocationMissingEmployee');
      }

      if (!Number.isInteger(allocation.tipsCents) || allocation.tipsCents < 0) {
        throw new BadRequestException('error.distribution.mlAllocationInvalidAmount');
      }

      const amount = centsToDecimal(allocation.tipsCents);
      const share = toDecimal(allocation.share).toDecimalPlaces(4);
      const weight = toDecimal(allocation.weight).toDecimalPlaces(4);

      return {
        employeeId: employee.employeeId,
        amount,
        contributionScore: weight,
        explanation: {
          roleCoefficient: decimalToJson(
            input.config.roleCoefficients[employee.role] ?? toDecimal(0),
          ),
          employeeCoefficient: decimalToJson(employee.coefficient),
          hoursWorked: decimalToJson(employee.hoursWorked),
          salesGenerated: moneyToJson(employee.salesGenerated),
          shiftAvgSales: moneyToJson(averageSales),
          salesBonus: '0.0000',
          baseScore: decimalToJson(weight),
          rawScore: decimalToJson(weight),
          scoreShare: decimalToJson(share),
          rawAmount: moneyToJson(amount),
          capAmount: '0.00',
          minAmount: '0.00',
          capApplied: false,
          minimumApplied: false,
          roundingAdjustmentCents: 0,
          finalAmount: moneyToJson(amount),
        },
      };
    });

    const distributedAmount = sumDecimals(results.map((result) => result.amount));
    const remainderCents = toCents(roundMoney(input.totalAmount)) - toCents(distributedAmount);

    if (remainderCents !== 0) {
      throw new BadRequestException('error.distribution.mlAllocationPoolMismatch');
    }

    return {
      result: {
        totalAmount: roundMoney(input.totalAmount),
        distributedAmount,
        remainderCents,
        results,
      },
      computationMethod: ComputationMethod.ML_ASSISTED,
      mlModelVersion: mlResult.modelVersion,
    };
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

  private async getSalesStats(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shiftId: string,
  ): Promise<SalesStats> {
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
      _count: {
        _all: true,
      },
    });

    const salesByEmployeeId = new Map(
      groupedSales.map((row) => [row.serverId, row._sum.totalAmount ?? toDecimal(0)]),
    );
    const ordersByEmployeeId = new Map(groupedSales.map((row) => [row.serverId, row._count._all]));
    const totalSales = sumDecimals(groupedSales.map((row) => row._sum.totalAmount ?? toDecimal(0)));

    return {
      salesByEmployeeId,
      ordersByEmployeeId,
      totalSales,
    };
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

  private buildFeaturesSnapshot(
    employee: EmployeeShiftInput | undefined,
    computed: ComputedDistribution,
  ): Prisma.InputJsonValue {
    if (!employee) {
      return {};
    }

    return {
      role: employee.role,
      hoursWorked: employee.hoursWorked.toString(),
      salesGenerated: employee.salesGenerated.toString(),
      coefficient: employee.coefficient.toString(),
      computationMethod: computed.computationMethod,
      mlModelVersion: computed.mlModelVersion ?? null,
    };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
