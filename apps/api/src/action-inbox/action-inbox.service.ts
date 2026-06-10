import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionItemStatus, AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ListActionItemsDto } from './dto/list-action-items.dto';
import { UpdateActionItemStatusDto } from './dto/update-action-item-status.dto';
import {
  ActionItemView,
  actionItemViewSelect,
  ListActionItemsResult,
} from './types/action-item-view.type';

const DEFAULT_LIMIT = 50;

@Injectable()
export class ActionInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, dto: ListActionItemsDto): Promise<ListActionItemsResult> {
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const offset = dto.offset ?? 0;

    const where: Prisma.ActionItemWhereInput = {
      tenantId,
      ...(dto.status?.length ? { status: { in: dto.status } } : {}),
      ...(dto.severity?.length ? { severity: { in: dto.severity } } : {}),
      ...(dto.type?.length ? { type: { in: dto.type } } : {}),
      ...(dto.shiftId ? { shiftId: dto.shiftId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.actionItem.findMany({
        where,
        select: actionItemViewSelect,
        // CRITICAL d'abord (ordre de l'enum : INFO < WARNING < CRITICAL), puis plus récent.
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.actionItem.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  /**
   * Transition manuelle OPEN → RESOLVED | DISMISSED.
   * Retourne 404 si l'item n'existe pas ou appartient à un autre tenant.
   */
  async updateStatus(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateActionItemStatusDto,
  ): Promise<ActionItemView> {
    const item = await this.prisma.actionItem.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });

    if (!item) {
      throw new NotFoundException('error.actionItem.notFound');
    }

    if (item.status !== ActionItemStatus.OPEN) {
      throw new BadRequestException('error.actionItem.invalidTransition');
    }

    // Garde concurrente : la mise à jour n'aboutit que si l'item est toujours OPEN.
    const result = await this.prisma.actionItem.updateMany({
      where: { id, tenantId, status: ActionItemStatus.OPEN },
      data: {
        status: dto.status,
        resolutionNote: dto.note ?? null,
        resolvedAt: new Date(),
        resolvedById: userId,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('error.actionItem.invalidTransition');
    }

    await this.audit.log({
      tenantId,
      userId,
      action:
        dto.status === ActionItemStatus.RESOLVED
          ? AuditAction.ACTION_ITEM_RESOLVED
          : AuditAction.ACTION_ITEM_DISMISSED,
      entityType: 'ActionItem',
      entityId: id,
      oldValues: { status: ActionItemStatus.OPEN },
      newValues: { status: dto.status, resolutionNote: dto.note ?? null },
      metadata: { reason: 'manual' },
    });

    const updated = await this.prisma.actionItem.findFirst({
      where: { id, tenantId },
      select: actionItemViewSelect,
    });

    if (!updated) {
      throw new NotFoundException('error.actionItem.notFound');
    }

    return updated;
  }
}
