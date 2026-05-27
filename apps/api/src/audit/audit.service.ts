import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditLogInput } from './types/audit-log-input.type';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldValues: input.oldValues ?? Prisma.JsonNull,
          newValues: input.newValues ?? Prisma.JsonNull,
          metadata: input.metadata ?? Prisma.JsonNull,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          requestId: input.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log: action=${input.action}, entityType=${input.entityType}, entityId=${input.entityId}, tenantId=${input.tenantId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // findAll avec select léger pour la liste
  async findAll(tenantId: string, limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userId: true,
        ipAddress: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }

  // findByEntity avec limit
  async findByEntity(tenantId: string, entityType: string, entityId: string, limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return this.prisma.auditLog.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }
}
