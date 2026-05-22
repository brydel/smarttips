import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipPoolStatus, ShiftStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTipPoolDto } from './dto/create-tip-pool.dto';
import { UpdateTipPoolDto } from './dto/update-tip-pool.dto';

@Injectable()
export class TipPoolsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly tipPoolSafeInclude = {
    distributions: {
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        employeeId: true,
        amount: true,
        contributionScore: true,
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
    },
    shift: {
      select: {
        id: true,
        date: true,
        shiftType: true,
        status: true,
      },
    },
  } satisfies Prisma.TipPoolInclude;

  async findByShift(tenantId: string, shiftId: string) {
    const pool = await this.prisma.tipPool.findFirst({
      where: {
        shiftId,
        tenantId,
        deletedAt: null,
      },
      include: this.tipPoolSafeInclude,
    });

    if (!pool) {
      throw new NotFoundException('error.tipPool.notFound');
    }

    return pool;
  }

  async create(tenantId: string, declaredBy: string, dto: CreateTipPoolDto) {
    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findFirst({
        where: {
          id: dto.shiftId,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('error.shift.notFound');
      }

      if (shift.status !== ShiftStatus.CLOSED) {
        throw new BadRequestException('error.shift.notClosed');
      }

      const existing = await tx.tipPool.findFirst({
        where: {
          shiftId: dto.shiftId,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        throw new ConflictException('error.tipPool.alreadyExists');
      }

      const cashAmount = this.toMoney(dto.cashAmount);
      const cardAmount = this.toMoney(dto.cardAmount);
      const totalAmount = cashAmount.add(cardAmount).toDecimalPlaces(2);

      if (totalAmount.lte(0)) {
        throw new BadRequestException('error.tipPool.totalAmountMustBePositive');
      }

      try {
        return await tx.tipPool.create({
          data: {
            tenantId,
            shiftId: dto.shiftId,
            declaredBy,
            cashAmount,
            cardAmount,
            totalAmount,
            notes: dto.notes,
            status: TipPoolStatus.DECLARED,
          },
          include: this.tipPoolSafeInclude,
        });
      } catch (error) {
        if (this.isPrismaUniqueViolation(error)) {
          throw new ConflictException('error.tipPool.alreadyExists');
        }

        throw error;
      }
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTipPoolDto) {
    if (dto.cashAmount === undefined && dto.cardAmount === undefined && dto.notes === undefined) {
      throw new BadRequestException('error.tipPool.emptyUpdate');
    }

    return this.prisma.$transaction(async (tx) => {
      const pool = await tx.tipPool.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          cashAmount: true,
          cardAmount: true,
        },
      });

      if (!pool) {
        throw new NotFoundException('error.tipPool.notFound');
      }

      if (pool.status !== TipPoolStatus.DECLARED) {
        throw new BadRequestException('error.tipPool.locked');
      }

      const cashAmount =
        dto.cashAmount !== undefined ? this.toMoney(dto.cashAmount) : pool.cashAmount;

      const cardAmount =
        dto.cardAmount !== undefined ? this.toMoney(dto.cardAmount) : pool.cardAmount;

      const totalAmount = cashAmount.add(cardAmount).toDecimalPlaces(2);

      if (totalAmount.lte(0)) {
        throw new BadRequestException('error.tipPool.totalAmountMustBePositive');
      }

      const updateResult = await tx.tipPool.updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
          status: TipPoolStatus.DECLARED,
        },
        data: {
          cashAmount,
          cardAmount,
          totalAmount,
          notes: dto.notes,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('error.tipPool.concurrentUpdateDetected');
      }

      const updatedPool = await tx.tipPool.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        include: this.tipPoolSafeInclude,
      });

      if (!updatedPool) {
        throw new NotFoundException('error.tipPool.notFound');
      }

      return updatedPool;
    });
  }

  async distribute(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const pool = await tx.tipPool.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          shiftId: true,
        },
      });

      if (!pool) {
        throw new NotFoundException('error.tipPool.notFound');
      }

      if (pool.status !== TipPoolStatus.DECLARED) {
        throw new BadRequestException('error.tipPool.alreadyDistributed');
      }

      if (pool.totalAmount.lte(0)) {
        throw new BadRequestException('error.tipPool.totalAmountMustBePositive');
      }

      const assignmentsCount = await tx.shiftAssignment.count({
        where: {
          tenantId,
          shiftId: pool.shiftId,
          deletedAt: null,
        },
      });

      if (assignmentsCount === 0) {
        throw new BadRequestException('error.tipPool.noEligibleAssignments');
      }

      const updateResult = await tx.tipPool.updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
          status: TipPoolStatus.DECLARED,
        },
        data: {
          status: TipPoolStatus.DISTRIBUTED,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('error.tipPool.concurrentDistribution');
      }

      const distributedPool = await tx.tipPool.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        include: this.tipPoolSafeInclude,
      });

      if (!distributedPool) {
        throw new NotFoundException('error.tipPool.notFound');
      }

      return distributedPool;
    });
  }

  private toMoney(value: number): Prisma.Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(2);
  }

  private isPrismaUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
