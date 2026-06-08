import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ComputationMethod,
  DistributionMode,
  OrderStatus,
  Prisma,
  ShiftStatus,
  TipPoolStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  DistributionCalculatorService,
  MlComputationMode,
  MlPrediction,
} from './distribution-calculator/distribution-calculator.service';
import { DistributionInvariantError } from './distribution-calculator/allocation';
import {
  Cents,
  DistributionPrediction,
  MlClientService,
  MlEmployeeContext,
  MlServiceUnavailableException,
  TrainEmployeeOutcome,
} from '../ml-client/ml-client.service';
import {
  isMlTrainingComputationMethod,
  MlTrainingProducer,
  MlTrainingProducerInput,
} from '../queue/ml-training.producer';
import {
  DEFAULT_ROLE_COEFFICIENTS,
  DistributionComputationResult,
  DistributionConfig,
  DistributionInput,
  EmployeeShiftInput,
  ShiftId,
  TenantId,
  TipPoolId,
  assertSupportedMode,
  toEmployeeId,
  toShiftId,
  toTenantId,
  toTipPoolId,
} from './distribution.types';
import { mapDistributionConfigFromPrisma } from './distribution.mapper';
import { AdjustDistributionDto } from './dto/adjust-distribution.dto';
import { centsToDecimal, roundMoney, toCents, toDecimal } from './distribution-calculator/money';

const MAX_ASSIGNMENTS_PER_DISTRIBUTION = 500;

// Phase-1 snapshot, re-checked in the phase-3 transaction so a change between the
// out-of-txn read and the write is detected before persisting stale amounts.
interface DistributionSnapshot {
  readonly shiftStatus: ShiftStatus;
  readonly tipPoolStatus: TipPoolStatus;
  readonly tipPoolAmountCents: number;
  readonly assignmentCount: number;
}

interface DistributionContext {
  readonly tenantId: TenantId;
  readonly shiftId: ShiftId;
  readonly tipPoolId: TipPoolId;
  readonly totalAmount: Prisma.Decimal;
  readonly poolCents: number;
  readonly config: DistributionConfig;
  readonly mode: DistributionMode;
  readonly employees: readonly EmployeeShiftInput[];
  readonly mlEmployees: readonly MlEmployeeContext[];
  readonly snapshot: DistributionSnapshot;
}

interface SalesData {
  readonly salesByEmployee: ReadonlyMap<string, Prisma.Decimal>;
  readonly ordersByEmployee: ReadonlyMap<string, number>;
  readonly shiftTotalSales: Prisma.Decimal;
}

interface AdjustmentTransactionResult {
  readonly trainingInput: MlTrainingProducerInput | null;
}

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: DistributionCalculatorService,
    private readonly mlClient: MlClientService,
    private readonly mlTrainingProducer: MlTrainingProducer,
  ) {}

  // Three phases on purpose: the ML network call must NOT run inside a DB
  // transaction. Reads + compute happen outside any write txn; the short write
  // txn re-validates the phase-1 snapshot and uses an optimistic lock on the pool
  // status as the linearization point against concurrent runs.
  async distribute(tenantId: string, shiftId: string): Promise<void> {
    const context = await this.loadDistributionContext(tenantId, shiftId);
    const computation = await this.computeDistribution(context);

    await this.persistDistribution(context, computation);
  }

  // --- PHASE 1: read + validate (no write transaction) ---------------------

  private async loadDistributionContext(
    tenantIdRaw: string,
    shiftIdRaw: string,
  ): Promise<DistributionContext> {
    const tenantId = toTenantId(tenantIdRaw);
    const shiftId = toShiftId(shiftIdRaw);

    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId, deletedAt: null },
      select: {
        id: true,
        status: true,
        shiftType: true,
        date: true,
        startTime: true,
        endTime: true,
        tipPool: { select: { id: true, status: true, totalAmount: true } },
        assignments: {
          where: { tenantId, deletedAt: null },
          select: {
            employeeId: true,
            roleDuringShift: true,
            scheduledHours: true,
            hoursWorked: true,
            employee: { select: { coefficient: true, active: true, deletedAt: true } },
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

    if (shift.assignments.length > MAX_ASSIGNMENTS_PER_DISTRIBUTION) {
      throw new BadRequestException('error.distribution.tooManyAssignments');
    }

    const existing = await this.prisma.tipDistribution.count({
      where: { tenantId, tipPoolId: shift.tipPool.id, deletedAt: null },
    });

    if (existing > 0) {
      throw new ConflictException('error.distribution.alreadyExists');
    }

    const { config, mode } = await this.resolveConfig(tenantId);
    const sales = await this.getSalesData(tenantId, shiftId);

    const employees = this.buildEmployeeInputs(shift.assignments, sales.salesByEmployee);
    const mlEmployees = this.buildMlContexts(shift, sales);
    const totalAmount = roundMoney(shift.tipPool.totalAmount);
    const poolCents = toCents(totalAmount);

    return {
      tenantId,
      shiftId,
      tipPoolId: toTipPoolId(shift.tipPool.id),
      totalAmount,
      poolCents,
      config,
      mode,
      employees,
      mlEmployees,
      snapshot: {
        shiftStatus: shift.status,
        tipPoolStatus: shift.tipPool.status,
        tipPoolAmountCents: poolCents,
        assignmentCount: shift.assignments.length,
      },
    };
  }

  // --- PHASE 2: compute (rules, or ML with fallback) — NO transaction ------

  private async computeDistribution(
    context: DistributionContext,
  ): Promise<DistributionComputationResult> {
    assertSupportedMode(context.mode);

    const input = this.toDistributionInput(context);

    // RULES_ONLY, or a non-positive pool (which the rules calculator rejects with
    // a clean 400 — the ML client would reject it as a programming error).
    if (context.mode === DistributionMode.RULES_ONLY || context.poolCents <= 0) {
      return this.calculator.compute(input);
    }

    const mlMode: MlComputationMode =
      context.mode === DistributionMode.ML_FULL ? 'ML_FULL' : 'ML_ASSISTED';

    try {
      const prediction = await this.mlClient.predictDistribution({
        tenantId: context.tenantId,
        shiftId: context.shiftId,
        poolCents: this.asCents(context.poolCents),
        employees: context.mlEmployees,
      });

      return this.calculator.computeFromMl(input, this.mapPrediction(prediction), mlMode);
    } catch (error) {
      // ONLY ml-unavailability degrades to rules; any other error propagates.
      if (error instanceof MlServiceUnavailableException) {
        this.logger.warn({
          event: 'ml_fallback_to_rules',
          reason: error.reason,
          tenantId: context.tenantId,
          shiftId: context.shiftId,
          configuredMode: context.mode,
        });

        // The realized method becomes RULES; the calculator stamps it (it does
        // not read input.computationMethod), so the persisted method reflects
        // what actually ran, never the configured mode.
        return this.calculator.compute(input);
      }

      throw error;
    }
  }

  // --- PHASE 3: persist (short txn, snapshot re-check + optimistic lock) ----

  private async persistDistribution(
    context: DistributionContext,
    computation: DistributionComputationResult,
  ): Promise<void> {
    const employeesById = new Map(
      context.employees.map((employee) => [employee.employeeId, employee]),
    );

    await this.prisma.$transaction(
      async (tx) => {
        const freshPool = await tx.tipPool.findFirst({
          where: { id: context.tipPoolId, tenantId: context.tenantId, deletedAt: null },
          select: {
            status: true,
            totalAmount: true,
            shift: {
              select: {
                status: true,
                assignments: {
                  where: { tenantId: context.tenantId, deletedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        });

        if (!freshPool) {
          throw new NotFoundException('error.distribution.tipPoolNotFound');
        }

        // Re-validate the phase-1 snapshot: the compute ran on an out-of-txn read,
        // so reject if anything that fed the amounts changed underneath us.
        if (freshPool.shift.status !== context.snapshot.shiftStatus) {
          throw new ConflictException('error.distribution.shiftChangedDuringComputation');
        }

        if (freshPool.status !== TipPoolStatus.DECLARED) {
          throw new ConflictException('error.distribution.concurrentDistribution');
        }

        if (toCents(roundMoney(freshPool.totalAmount)) !== context.snapshot.tipPoolAmountCents) {
          throw new ConflictException('error.distribution.tipPoolChangedDuringComputation');
        }

        if (freshPool.shift.assignments.length !== context.snapshot.assignmentCount) {
          throw new ConflictException('error.distribution.assignmentsChangedDuringComputation');
        }

        const existing = await tx.tipDistribution.count({
          where: { tenantId: context.tenantId, tipPoolId: context.tipPoolId, deletedAt: null },
        });

        if (existing > 0) {
          throw new ConflictException('error.distribution.alreadyExists');
        }

        // Optimistic lock: only the run that flips DECLARED -> DISTRIBUTED proceeds.
        const locked = await tx.tipPool.updateMany({
          where: {
            id: context.tipPoolId,
            tenantId: context.tenantId,
            deletedAt: null,
            status: TipPoolStatus.DECLARED,
          },
          data: { status: TipPoolStatus.DISTRIBUTED },
        });

        if (locked.count !== 1) {
          throw new ConflictException('error.distribution.concurrentDistribution');
        }

        const data = computation.results.map((result) => {
          const employee = employeesById.get(result.employeeId);

          if (!employee) {
            throw new DistributionInvariantError('error.distribution.missingEmployeeSnapshot');
          }

          return {
            tenantId: context.tenantId,
            tipPoolId: context.tipPoolId,
            employeeId: result.employeeId,
            amount: result.amount,
            contributionScore: result.contributionScore,
            featuresSnapshot: this.buildFeaturesSnapshot(employee),
            explanation: this.toJsonValue(result.explanation),
            // The REALIZED method (RULES if the breaker tripped in an ML mode).
            computationMethod: computation.computationMethod,
          };
        });

        const created = await tx.tipDistribution.createMany({ data });

        if (created.count !== data.length) {
          throw new DistributionInvariantError('error.distribution.createManyCountMismatch');
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 2_000,
        timeout: 5_000,
      },
    );
  }

  async getDistribution(tenantIdRaw: string, shiftIdRaw: string) {
    const tenantId = toTenantId(tenantIdRaw);
    const shiftId = toShiftId(shiftIdRaw);

    const tipPool = await this.prisma.tipPool.findFirst({
      where: { tenantId, shiftId, deletedAt: null },
      select: { id: true },
    });

    if (!tipPool) {
      throw new NotFoundException('error.distribution.tipPoolNotFound');
    }

    const distributions = await this.prisma.tipDistribution.findMany({
      where: { tenantId, tipPoolId: tipPool.id, deletedAt: null },
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
        employee: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: [{ amount: 'desc' }, { employeeId: 'asc' }],
      take: MAX_ASSIGNMENTS_PER_DISTRIBUTION,
    });

    if (distributions.length === 0) {
      throw new NotFoundException('error.distribution.notFound');
    }

    return distributions;
  }

  async adjustDistribution(
    tenantIdRaw: string,
    shiftIdRaw: string,
    userId: string,
    dto: AdjustDistributionDto,
  ): Promise<void> {
    const tenantId = toTenantId(tenantIdRaw);
    const shiftId = toShiftId(shiftIdRaw);

    const { trainingInput } = await this.prisma.$transaction(
      async (tx): Promise<AdjustmentTransactionResult> => {
        const tipPool = await tx.tipPool.findFirst({
          where: { tenantId, shiftId, deletedAt: null },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            shift: {
              select: {
                shiftType: true,
                date: true,
                startTime: true,
                endTime: true,
                assignments: {
                  where: { tenantId, deletedAt: null },
                  select: {
                    employeeId: true,
                    roleDuringShift: true,
                  },
                },
              },
            },
            distributions: {
              where: { tenantId, deletedAt: null },
              select: {
                employeeId: true,
                amount: true,
                originalAmount: true,
                computationMethod: true,
              },
            },
          },
        });

        if (!tipPool) {
          throw new NotFoundException('error.distribution.tipPoolNotFound');
        }

        if (tipPool.status !== TipPoolStatus.DISTRIBUTED) {
          throw new BadRequestException('error.distribution.tipPoolNotDistributed');
        }

        if (tipPool.distributions.length === 0) {
          throw new NotFoundException('error.distribution.notFound');
        }

        const allocations = this.validateAdjustmentAllocations(
          dto,
          toCents(roundMoney(tipPool.totalAmount)),
          tipPool.distributions.map((distribution) => distribution.employeeId),
        );

        const sourceMethods = new Set(
          tipPool.distributions.map((distribution) => distribution.computationMethod),
        );
        const sourceComputationMethod =
          sourceMethods.size === 1
            ? tipPool.distributions[0]!.computationMethod
            : ComputationMethod.MANUAL_OVERRIDE;
        const tenantMode = await this.resolveTenantMode(tx, tenantId);
        const shouldTrain =
          this.isMlDistributionMode(tenantMode) &&
          isMlTrainingComputationMethod(sourceComputationMethod);

        for (const distribution of tipPool.distributions) {
          const tipsCents = allocations.get(distribution.employeeId);

          if (tipsCents === undefined) {
            throw new BadRequestException('error.distribution.resultRosterMismatch');
          }

          const updated = await tx.tipDistribution.updateMany({
            where: {
              tenantId,
              tipPoolId: tipPool.id,
              employeeId: distribution.employeeId,
              deletedAt: null,
              amount: distribution.amount,
            },
            data: {
              amount: centsToDecimal(tipsCents),
              originalAmount: distribution.originalAmount ?? distribution.amount,
              adjustedBy: userId,
              adjustmentReason: dto.reason ?? null,
              computationMethod: ComputationMethod.MANUAL_OVERRIDE,
            },
          });

          if (updated.count !== 1) {
            throw new ConflictException('error.distribution.concurrentDistribution');
          }
        }

        if (!shouldTrain) {
          return { trainingInput: null };
        }

        const sales = await this.getSalesDataTx(tx, tenantId, shiftId);
        const mlEmployees = this.buildMlContexts(tipPool.shift, sales);
        const trainingEmployees = mlEmployees.map((employee): TrainEmployeeOutcome => {
          const tipsCents = allocations.get(employee.employeeId);

          if (tipsCents === undefined) {
            throw new DistributionInvariantError('error.distribution.missingEmployeeSnapshot');
          }

          return {
            ...employee,
            tipsReceivedCents: this.asCents(tipsCents),
          };
        });

        return {
          trainingInput: {
            tenantId,
            shiftId,
            computationMethod: sourceComputationMethod,
            employees: trainingEmployees,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 2_000,
        timeout: 5_000,
      },
    );

    if (trainingInput) {
      await this.mlTrainingProducer.enqueue(trainingInput);
    }
  }

  // --- helpers -------------------------------------------------------------

  private validateAdjustmentAllocations(
    dto: AdjustDistributionDto,
    poolCents: number,
    expectedEmployeeIds: readonly string[],
  ): ReadonlyMap<string, number> {
    const expected = new Set(expectedEmployeeIds);
    const allocations = new Map<string, number>();
    let totalCents = 0;

    for (const allocation of dto.allocations) {
      if (allocations.has(allocation.employeeId)) {
        throw new BadRequestException('error.distribution.duplicateEmployeeId');
      }

      if (!expected.has(allocation.employeeId)) {
        throw new BadRequestException('error.distribution.resultRosterMismatch');
      }

      if (!Number.isSafeInteger(allocation.tipsCents) || allocation.tipsCents < 0) {
        throw new BadRequestException('error.distribution.invalidCents');
      }

      allocations.set(allocation.employeeId, allocation.tipsCents);
      totalCents += allocation.tipsCents;
    }

    if (allocations.size !== expected.size) {
      throw new BadRequestException('error.distribution.resultRosterMismatch');
    }

    if (totalCents !== poolCents) {
      throw new BadRequestException('error.distribution.integrityViolation');
    }

    return allocations;
  }

  private async resolveTenantMode(
    tx: Prisma.TransactionClient,
    tenantId: TenantId,
  ): Promise<DistributionMode> {
    const config = await tx.distributionConfig.findUnique({
      where: { tenantId },
      select: { mode: true },
    });

    return config?.mode ?? DistributionMode.RULES_ONLY;
  }

  private isMlDistributionMode(mode: DistributionMode): boolean {
    return mode === DistributionMode.ML_ASSISTED || mode === DistributionMode.ML_FULL;
  }

  private toDistributionInput(context: DistributionContext): DistributionInput {
    return {
      tenantId: context.tenantId,
      tipPoolId: context.tipPoolId,
      shiftId: context.shiftId,
      totalAmount: context.totalAmount,
      config: context.config,
      employees: context.employees,
      // Placeholder; the calculator sets the realized method by which method runs.
      computationMethod: ComputationMethod.RULES,
    };
  }

  private mapPrediction(prediction: DistributionPrediction): MlPrediction {
    return {
      modelVersion: prediction.modelVersion,
      weights: prediction.allocations.map((allocation) => ({
        employeeId: toEmployeeId(allocation.employeeId),
        weight: toDecimal(allocation.weight),
        share: toDecimal(allocation.share),
      })),
    };
  }

  private async resolveConfig(
    tenantId: TenantId,
  ): Promise<{ readonly config: DistributionConfig; readonly mode: DistributionMode }> {
    const config = await this.prisma.distributionConfig.findUnique({
      where: { tenantId },
      select: {
        roleCoefficients: true,
        minPerHour: true,
        maxSharePct: true,
        salesBonusWeight: true,
        mode: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return { config: this.getDefaultConfig(), mode: DistributionMode.RULES_ONLY };
    }

    // NOTE: mapDistributionConfigFromPrisma must set policyVersion from
    // row.updatedAt.toISOString() (one-line mapper change).
    return { config: mapDistributionConfigFromPrisma(config), mode: config.mode };
  }

  private getDefaultConfig(): DistributionConfig {
    return {
      roleCoefficients: { ...DEFAULT_ROLE_COEFFICIENTS },
      minimumPerHour: toDecimal(2),
      maxSharePercent: toDecimal(35),
      salesBonusWeight: toDecimal(0.5),
      policyVersion: 'default-v1',
    };
  }

  private async getSalesData(tenantId: TenantId, shiftId: ShiftId): Promise<SalesData> {
    return this.getSalesDataTx(this.prisma, tenantId, shiftId);
  }

  private async getSalesDataTx(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: TenantId,
    shiftId: ShiftId,
  ): Promise<SalesData> {
    const grouped = await tx.order.groupBy({
      by: ['serverId'],
      where: {
        tenantId,
        shiftId,
        deletedAt: null,
        status: OrderStatus.PAID,
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    const salesByEmployee = new Map<string, Prisma.Decimal>();
    const ordersByEmployee = new Map<string, number>();
    let shiftTotalSales = toDecimal(0);

    for (const row of grouped) {
      if (!row.serverId) {
        continue;
      }

      const totalAmount = row._sum?.totalAmount ?? toDecimal(0);
      const orderCount = (row._count as { readonly _all?: number } | undefined)?._all ?? 0;

      salesByEmployee.set(row.serverId, totalAmount);
      ordersByEmployee.set(row.serverId, orderCount);
      shiftTotalSales = shiftTotalSales.add(totalAmount);
    }

    return { salesByEmployee, ordersByEmployee, shiftTotalSales };
  }

  private buildEmployeeInputs(
    assignments: ReadonlyArray<{
      readonly employeeId: string;
      readonly roleDuringShift: EmployeeShiftInput['role'];
      readonly scheduledHours: Prisma.Decimal;
      readonly hoursWorked: Prisma.Decimal | null;
      readonly employee: {
        readonly coefficient: Prisma.Decimal | null;
        readonly active: boolean;
        readonly deletedAt: Date | null;
      };
    }>,
    salesByEmployee: ReadonlyMap<string, Prisma.Decimal>,
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
        employeeId: toEmployeeId(assignment.employeeId),
        role: assignment.roleDuringShift,
        hoursWorked: effectiveHours,
        salesGenerated: salesByEmployee.get(assignment.employeeId) ?? toDecimal(0),
        coefficient: assignment.employee.coefficient ?? toDecimal(1),
      };
    });
  }

  private buildMlContexts(
    shift: {
      readonly shiftType: string;
      readonly date: Date;
      readonly startTime: Date;
      readonly endTime: Date;
      readonly assignments: ReadonlyArray<{
        readonly employeeId: string;
        readonly roleDuringShift: string;
      }>;
    },
    sales: SalesData,
  ): MlEmployeeContext[] {
    // FEATURE PARITY WARNING: dayOfWeek and the hour fields MUST match the
    // convention the generator/ml-service trained on. We assume the Python
    // generator's weekday() (Monday=0..Sunday=6) and naive local hours stored as
    // UTC. Verify against apps/data-generator before relying on ML quality — a
    // skew here silently degrades predictions (allocation stays safe via bounds).
    const dayOfWeek = (shift.date.getUTCDay() + 6) % 7;
    const hourStart = shift.startTime.getUTCHours();
    const hourEnd = shift.endTime.getUTCHours();
    const employeeCount = shift.assignments.length;
    const salesTotalCents = this.asCents(toCents(roundMoney(sales.shiftTotalSales)));

    return shift.assignments.map((assignment) => ({
      employeeId: toEmployeeId(assignment.employeeId),
      role: assignment.roleDuringShift,
      shiftType: shift.shiftType,
      dayOfWeek,
      hourStart,
      hourEnd,
      employeeCount,
      salesTotalCents,
      assignedSalesCents: this.asCents(
        toCents(roundMoney(sales.salesByEmployee.get(assignment.employeeId) ?? toDecimal(0))),
      ),
      ordersCount: sales.ordersByEmployee.get(assignment.employeeId) ?? 0,
    }));
  }

  private buildFeaturesSnapshot(employee: EmployeeShiftInput): Prisma.InputJsonValue {
    return {
      role: employee.role,
      hoursWorked: employee.hoursWorked.toString(),
      salesGenerated: employee.salesGenerated.toString(),
      coefficient: employee.coefficient.toString(),
    };
  }

  // Typed interfaces (the discriminated explanation union) lack an index
  // signature, so a JSON round-trip is the safe way to land them in a Prisma Json
  // column without a TS assignability error.
  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  // Cents brand lives in ml-client; cast pending the common/branded.ts
  // consolidation. Validated because these come from our own money math.
  private asCents(value: number): Cents {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new DistributionInvariantError('error.distribution.invalidCents');
    }

    return value as Cents;
  }
}
