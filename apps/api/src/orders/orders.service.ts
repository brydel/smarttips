import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ShiftStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly orderSafeInclude = {
    items: {
      where: {
        voided: false,
      },
      select: {
        id: true,
        menuItemId: true,
        quantity: true,
        unitPrice: true,
        subtotal: true,
        notes: true,
        menuItem: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
    table: {
      select: {
        id: true,
        tableNumber: true,
        section: true,
      },
    },
    server: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    },
  } satisfies Prisma.OrderInclude;

  async findAll(tenantId: string, query: FindOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      ...(query.serverId ? { serverId: query.serverId } : {}),
      ...(query.tableId ? { tableId: query.tableId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.date ? { openedAt: this.buildDateFilter(query.date) } : {}),
    };

    return this.prisma.order.findMany({
      where,
      include: this.orderSafeInclude,
      orderBy: {
        openedAt: 'desc',
      },
      take: query.limit ?? 50,
      ...(query.cursor
        ? {
            cursor: {
              id: query.cursor,
            },
            skip: 1,
          }
        : {}),
    });
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: this.orderSafeInclude,
    });

    if (!order) {
      throw new NotFoundException('error.order.notFound');
    }

    return order;
  }

  async create(tenantId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      this.assertNoDuplicateMenuItems(dto.items.map((item) => item.menuItemId));

      const tenant = await tx.tenant.findFirst({
        where: {
          id: tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          taxRate: true,
        },
      });

      if (!tenant) {
        throw new NotFoundException('error.tenant.notFound');
      }

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

      if (shift.status === ShiftStatus.CLOSED || shift.status === ShiftStatus.CANCELLED) {
        throw new BadRequestException('error.shift.notAcceptingOrders');
      }

      const server = await tx.employee.findFirst({
        where: {
          id: dto.serverId,
          tenantId,
          deletedAt: null,
          active: true,
        },
        select: {
          id: true,
        },
      });

      if (!server) {
        throw new BadRequestException('error.server.invalidOrForeign');
      }

      const serverAssignment = await tx.shiftAssignment.findFirst({
        where: {
          tenantId,
          shiftId: dto.shiftId,
          employeeId: dto.serverId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!serverAssignment) {
        throw new BadRequestException('error.server.notAssignedToShift');
      }

      const table = await tx.restaurantTable.findFirst({
        where: {
          id: dto.tableId,
          tenantId,
          deletedAt: null,
          active: true,
        },
        select: {
          id: true,
        },
      });

      if (!table) {
        throw new BadRequestException('error.table.invalidOrForeign');
      }

      const menuItems = await tx.menuItem.findMany({
        where: {
          id: {
            in: dto.items.map((item) => item.menuItemId),
          },
          tenantId,
          active: true,
          deletedAt: null,
        },
        select: {
          id: true,
          price: true,
        },
      });

      if (menuItems.length !== dto.items.length) {
        throw new BadRequestException('error.order.invalidMenuItems');
      }

      const priceMap = new Map(menuItems.map((item) => [item.id, item.price]));

      let subtotal = new Prisma.Decimal(0);

      const itemsData = dto.items.map((item) => {
        const unitPrice = priceMap.get(item.menuItemId);

        if (!unitPrice) {
          throw new BadRequestException('error.order.invalidMenuItem');
        }

        const itemSubtotal = unitPrice.mul(item.quantity);
        subtotal = subtotal.add(itemSubtotal);

        return {
          tenantId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemSubtotal,
          notes: item.notes,
        };
      });

      const taxAmount = this.roundMoney(subtotal.mul(tenant.taxRate));
      const totalAmount = this.roundMoney(subtotal.add(taxAmount));

      try {
        return await tx.order.create({
          data: {
            tenantId,
            shiftId: dto.shiftId,
            tableId: dto.tableId,
            serverId: dto.serverId,
            orderNumber: this.generateOrderNumber(),
            guestCount: dto.guestCount ?? 1,
            subtotal,
            taxAmount,
            totalAmount,
            status: OrderStatus.OPEN,
            items: {
              create: itemsData,
            },
          },
          include: this.orderSafeInclude,
        });
      } catch (error) {
        if (this.isPrismaUniqueViolation(error)) {
          throw new ConflictException('error.order.numberConflict');
        }

        throw error;
      }
    });
  }

  async update(tenantId: string, id: string, dto: UpdateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!order) {
        throw new NotFoundException('error.order.notFound');
      }

      if (order.status !== OrderStatus.OPEN) {
        throw new BadRequestException('error.order.notOpen');
      }

      const updateResult = await tx.order.updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
          status: OrderStatus.OPEN,
        },
        data: {
          guestCount: dto.guestCount,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('error.order.concurrentUpdateDetected');
      }

      const updatedOrder = await tx.order.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        include: this.orderSafeInclude,
      });

      if (!updatedOrder) {
        throw new NotFoundException('error.order.notFound');
      }

      return updatedOrder;
    });
  }

  async payOrder(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        include: {
          items: {
            where: {
              voided: false,
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('error.order.notFound');
      }

      if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.SENT) {
        throw new BadRequestException('error.order.notPayable');
      }

      if (order.items.length === 0) {
        throw new BadRequestException('error.order.noItems');
      }

      const closedAt = new Date();
      const durationMinutes = Math.max(
        0,
        Math.round((closedAt.getTime() - order.openedAt.getTime()) / 60000),
      );

      const updateResult = await tx.order.updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
          status: {
            in: [OrderStatus.OPEN, OrderStatus.SENT],
          },
        },
        data: {
          status: OrderStatus.PAID,
          closedAt,
          durationMinutes,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException('error.order.concurrentPaymentDetected');
      }

      const paidOrder = await tx.order.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        include: this.orderSafeInclude,
      });

      if (!paidOrder) {
        throw new NotFoundException('error.order.notFound');
      }

      return paidOrder;
    });
  }

  private assertNoDuplicateMenuItems(menuItemIds: string[]): void {
    const uniqueMenuItemIds = new Set(menuItemIds);

    if (uniqueMenuItemIds.size !== menuItemIds.length) {
      throw new BadRequestException('error.order.duplicateMenuItems');
    }
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now();
    const entropy = randomUUID().slice(0, 8).toUpperCase();

    return `ORD-${timestamp}-${entropy}`;
  }

  private roundMoney(value: Prisma.Decimal): Prisma.Decimal {
    return value.toDecimalPlaces(2);
  }

  private buildDateFilter(date: string): Prisma.DateTimeFilter {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    if (Number.isNaN(startOfDay.getTime()) || Number.isNaN(endOfDay.getTime())) {
      throw new BadRequestException('error.order.invalidDate');
    }

    return {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  private isPrismaUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
