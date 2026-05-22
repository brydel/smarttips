import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, Prisma, ShiftStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { FindShiftsQueryDto } from './dto/find-shifts-query.dto';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly shiftSafeInclude = {
    assignments: {
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        shiftId: true,
        employeeId: true,
        roleDuringShift: true,
        scheduledHours: true,
        hoursWorked: true,
        breakMinutes: true,
        checkInAt: true,
        checkOutAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            active: true,
          },
        },
      },
    },
  } satisfies Prisma.ShiftInclude;

  async findAll(tenantId: string, query: FindShiftsQueryDto) {
    const where: Prisma.ShiftWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.date) {
      where.date = this.parseDateOnly(query.date);
    }

    return this.prisma.shift.findMany({
      where,
      include: this.shiftSafeInclude,
      orderBy: {
        startTime: 'desc',
      },
      take: 100,
    });
  }

  async findOne(tenantId: string, shiftId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: shiftId,
        tenantId,
        deletedAt: null,
      },
      include: this.shiftSafeInclude,
    });

    if (!shift) {
      throw new NotFoundException('error.shift.notFound');
    }

    return shift;
  }

  async create(tenantId: string, createdBy: string, dto: CreateShiftDto) {
    const date = this.parseDateOnly(dto.date);
    const startTime = this.parseDateTime(dto.startTime, 'error.shift.invalidStartTime');
    const endTime = this.parseDateTime(dto.endTime, 'error.shift.invalidEndTime');

    if (endTime <= startTime) {
      throw new BadRequestException('error.shift.endTimeBeforeStartTime');
    }

    try {
      return await this.prisma.shift.create({
        data: {
          tenantId,
          createdBy,
          date,
          shiftType: dto.shiftType,
          startTime,
          endTime,
          notes: dto.notes,
          status: ShiftStatus.PLANNED,
        },
        include: this.shiftSafeInclude,
      });
    } catch (error) {
      if (this.isPrismaUniqueViolation(error)) {
        throw new ConflictException('error.shift.alreadyExistsForDateAndType');
      }

      throw error;
    }
  }

  async addAssignment(tenantId: string, shiftId: string, dto: CreateAssignmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const shift = await this.findShiftForMutationOrThrow(tx, tenantId, shiftId);

      if (shift.status === ShiftStatus.CLOSED || shift.status === ShiftStatus.CANCELLED) {
        throw new BadRequestException('error.shift.notAssignable');
      }

      const employee = await tx.employee.findFirst({
        where: {
          id: dto.employeeId,
          tenantId,
          active: true,
          deletedAt: null,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!employee) {
        throw new BadRequestException('error.employee.invalidOrForeign');
      }

      try {
        return await tx.shiftAssignment.create({
          data: {
            tenantId,
            shiftId,
            employeeId: dto.employeeId,
            roleDuringShift: dto.roleDuringShift ?? employee.role,
            scheduledHours: dto.scheduledHours,
            breakMinutes: dto.breakMinutes ?? 0,
            status: AssignmentStatus.ASSIGNED,
          },
          select: {
            id: true,
            tenantId: true,
            shiftId: true,
            employeeId: true,
            roleDuringShift: true,
            scheduledHours: true,
            hoursWorked: true,
            breakMinutes: true,
            checkInAt: true,
            checkOutAt: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        });
      } catch (error) {
        if (this.isPrismaUniqueViolation(error)) {
          throw new ConflictException('error.shift.employeeAlreadyAssigned');
        }

        throw error;
      }
    });
  }

  async updateAssignment(
    tenantId: string,
    shiftId: string,
    employeeId: string,
    dto: UpdateAssignmentDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const shift = await this.findShiftForMutationOrThrow(tx, tenantId, shiftId);

      if (shift.status === ShiftStatus.CLOSED || shift.status === ShiftStatus.CANCELLED) {
        throw new BadRequestException('error.shift.assignmentLocked');
      }

      const assignment = await tx.shiftAssignment.findFirst({
        where: {
          tenantId,
          shiftId,
          employeeId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!assignment) {
        throw new NotFoundException('error.shift.assignmentNotFound');
      }

      return tx.shiftAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          hoursWorked: dto.hoursWorked,
          breakMinutes: dto.breakMinutes,
          checkInAt: dto.checkInAt
            ? this.parseDateTime(dto.checkInAt, 'error.assignment.invalidCheckInAt')
            : undefined,
          checkOutAt: dto.checkOutAt
            ? this.parseDateTime(dto.checkOutAt, 'error.assignment.invalidCheckOutAt')
            : undefined,
          status: dto.status,
        },
        select: {
          id: true,
          tenantId: true,
          shiftId: true,
          employeeId: true,
          roleDuringShift: true,
          scheduledHours: true,
          hoursWorked: true,
          breakMinutes: true,
          checkInAt: true,
          checkOutAt: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });
    });
  }

  async removeAssignment(tenantId: string, shiftId: string, employeeId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const shift = await this.findShiftForMutationOrThrow(tx, tenantId, shiftId);

      if (shift.status === ShiftStatus.CLOSED || shift.status === ShiftStatus.CANCELLED) {
        throw new BadRequestException('error.shift.assignmentLocked');
      }

      const assignment = await tx.shiftAssignment.findFirst({
        where: {
          tenantId,
          shiftId,
          employeeId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!assignment) {
        throw new NotFoundException('error.shift.assignmentNotFound');
      }

      await tx.shiftAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    });
  }

  async closeShift(tenantId: string, closedBy: string, shiftId: string) {
    return this.prisma.$transaction(async (tx) => {
      const shift = await this.findShiftForMutationOrThrow(tx, tenantId, shiftId);

      if (shift.status === ShiftStatus.CLOSED) {
        throw new BadRequestException('error.shift.alreadyClosed');
      }

      if (shift.status === ShiftStatus.CANCELLED) {
        throw new BadRequestException('error.shift.cancelled');
      }

      const assignmentsCount = await tx.shiftAssignment.count({
        where: {
          tenantId,
          shiftId,
          deletedAt: null,
        },
      });

      if (assignmentsCount === 0) {
        throw new BadRequestException('error.shift.noAssignments');
      }

      const updateResult = await tx.shift.updateMany({
        where: {
          id: shiftId,
          tenantId,
          deletedAt: null,
          status: {
            not: ShiftStatus.CLOSED,
          },
        },
        data: {
          status: ShiftStatus.CLOSED,
          actualEndTime: new Date(),
          closedBy,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('error.shift.concurrentCloseDetected');
      }

      const closedShift = await tx.shift.findFirst({
        where: {
          id: shiftId,
          tenantId,
          deletedAt: null,
        },
        include: this.shiftSafeInclude,
      });

      if (!closedShift) {
        throw new NotFoundException('error.shift.notFound');
      }

      return closedShift;
    });
  }

  private async findShiftForMutationOrThrow(tx: PrismaTx, tenantId: string, shiftId: string) {
    const shift = await tx.shift.findFirst({
      where: {
        id: shiftId,
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        endTime: true,
        actualEndTime: true,
      },
    });

    if (!shift) {
      throw new NotFoundException('error.shift.notFound');
    }

    return shift;
  }

  private parseDateOnly(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('error.shift.invalidDate');
    }

    const parsedDate = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('error.shift.invalidDate');
    }

    return parsedDate;
  }

  private parseDateTime(value: string, errorCode: string): Date {
    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(errorCode);
    }

    return parsedDate;
  }

  private isPrismaUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
