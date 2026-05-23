import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';

@Injectable()
export class MenuCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly categorySafeSelect = {
    id: true,
    name: true,
    displayOrder: true,
    active: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        items: {
          where: {
            deletedAt: null,
          },
        },
      },
    },
  } satisfies Prisma.MenuCategorySelect;

  async findAll(tenantId: string) {
    return this.prisma.menuCategory.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: this.categorySafeSelect,
    });
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.menuCategory.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      select: this.categorySafeSelect,
    });

    if (!category) {
      throw new NotFoundException('error.menuCategory.notFound');
    }

    return category;
  }

  async create(tenantId: string, dto: CreateMenuCategoryDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertNameAvailable(tx, tenantId, dto.name);

      try {
        return await tx.menuCategory.create({
          data: {
            tenantId,
            name: dto.name,
            displayOrder: dto.displayOrder ?? 0,
            active: dto.active ?? true,
          },
          select: this.categorySafeSelect,
        });
      } catch (error) {
        if (this.isPrismaUniqueViolation(error)) {
          throw new ConflictException('error.menuCategory.nameConflict');
        }

        throw error;
      }
    });
  }

  async update(tenantId: string, id: string, dto: UpdateMenuCategoryDto) {
    if (dto.name === undefined && dto.displayOrder === undefined && dto.active === undefined) {
      throw new BadRequestException('error.menuCategory.emptyUpdate');
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.menuCategory.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!category) {
        throw new NotFoundException('error.menuCategory.notFound');
      }

      if (dto.name !== undefined && dto.name !== category.name) {
        await this.assertNameAvailable(tx, tenantId, dto.name, id);
      }

      let updateResult: Awaited<ReturnType<typeof tx.menuCategory.updateMany>>;
      try {
        updateResult = await tx.menuCategory.updateMany({
          where: {
            id,
            tenantId,
            deletedAt: null,
          },
          data: {
            name: dto.name,
            displayOrder: dto.displayOrder,
            active: dto.active,
          },
        });
      } catch (error) {
        if (this.isPrismaUniqueViolation(error)) {
          throw new ConflictException('error.menuCategory.nameConflict');
        }
        throw error;
      }

      if (updateResult.count !== 1) {
        throw new ConflictException('error.menuCategory.concurrentUpdateDetected');
      }

      const updatedCategory = await tx.menuCategory.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        select: this.categorySafeSelect,
      });

      if (!updatedCategory) {
        throw new NotFoundException('error.menuCategory.notFound');
      }

      return updatedCategory;
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.menuCategory.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!category) {
        throw new NotFoundException('error.menuCategory.notFound');
      }

      const activeItems = await tx.menuItem.count({
        where: {
          categoryId: id,
          tenantId,
          deletedAt: null,
          active: true,
        },
      });

      if (activeItems > 0) {
        throw new BadRequestException('error.menuCategory.hasActiveItems');
      }

      const updateResult = await tx.menuCategory.updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          active: false,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('error.menuCategory.concurrentDeleteDetected');
      }
    });
  }

  private async assertNameAvailable(
    tx: Prisma.TransactionClient,
    tenantId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existingCategory = await tx.menuCategory.findFirst({
      where: {
        tenantId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingCategory) {
      throw new ConflictException('error.menuCategory.nameConflict');
    }
  }

  private isPrismaUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
