import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, EmployeeRole } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, role?: EmployeeRole, active?: boolean) {
    return this.prisma.employee.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(role !== undefined && { role }),
        ...(active !== undefined && { active }),
      },
      orderBy: { firstName: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('error.employee.notFound');
    }

    return employee;
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    if (dto.email) {
      const exists = await this.prisma.employee.findFirst({
        where: { email: dto.email, tenantId, deletedAt: null },
      });

      if (exists) {
        throw new ConflictException('error.employee.emailConflict');
      }
    }

    try {
      return await this.prisma.employee.create({
        data: {
          ...dto,
          tenantId,
          coefficient: dto.coefficient ?? 1.0,
          hireDate: new Date(dto.hireDate),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('error.employee.emailConflict');
      }
      throw new InternalServerErrorException('error.employee.creationFailed');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    const hasFields = Object.keys(dto).some(
      (k) => (dto as Record<string, unknown>)[k] !== undefined,
    );

    if (!hasFields) {
      throw new BadRequestException('error.employee.update.emptyPayload');
    }

    await this.findOne(tenantId, id);

    try {
      return await this.prisma.employee.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('error.employee.emailConflict');
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    const employee = await this.findOne(tenantId, id);

    return this.prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        email: `${employee.email}.deleted.${Date.now()}`,
      },
    });
  }
}
