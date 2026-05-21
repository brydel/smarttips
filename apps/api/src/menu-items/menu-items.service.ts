import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, categoryId?: string, active?: boolean) {
    return this.prisma.menuItem.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(categoryId !== undefined && { categoryId }),
        ...(active !== undefined && { active }),
      },
      orderBy: [{ name: 'asc' }],
      include: { category: true },
    });
  }

  async findCategories(tenantId: string) {
    return this.prisma.menuCategory.findMany({
      where: { tenantId, deletedAt: null, active: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    });

    if (!item) {
      throw new NotFoundException('error.menuItem.notFound');
    }

    return item;
  }

  private async verifyCategoryOwnership(tenantId: string, categoryId: string) {
    const category = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, tenantId, deletedAt: null },
    });

    if (!category) {
      throw new BadRequestException('error.menuCategory.invalidOrForeign');
    }
  }

  async create(tenantId: string, dto: CreateMenuItemDto) {
    if (dto.cost !== undefined && dto.cost > dto.price) {
      throw new BadRequestException('error.menuItem.costExceedsPrice');
    }

    await this.verifyCategoryOwnership(tenantId, dto.categoryId);

    try {
      return await this.prisma.menuItem.create({
        data: {
          ...dto,
          tenantId,
          active: dto.active ?? true,
        },
        include: { category: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('error.menuItem.nameConflict');
      }
      throw new InternalServerErrorException('error.menuItem.creationFailed');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateMenuItemDto) {
    const hasFields = Object.keys(dto).some(
      (k) => (dto as Record<string, unknown>)[k] !== undefined,
    );

    if (!hasFields) {
      throw new BadRequestException('error.validation.update.emptyPayload');
    }

    const item = await this.findOne(tenantId, id);

    const newPrice = dto.price !== undefined ? dto.price : Number(item.price);
    const newCost =
      dto.cost !== undefined ? dto.cost : item.cost !== null ? Number(item.cost) : undefined;

    if (newCost !== null && newCost !== undefined && newCost > newPrice) {
      throw new BadRequestException('error.menuItem.costExceedsPrice');
    }

    try {
      return await this.prisma.menuItem.update({
        where: { id },
        data: dto,
        include: { category: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('error.menuItem.nameConflict');
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    const item = await this.findOne(tenantId, id);

    return this.prisma.menuItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        name: `${item.name}.deleted.${Date.now()}`,
      },
    });
  }
}
