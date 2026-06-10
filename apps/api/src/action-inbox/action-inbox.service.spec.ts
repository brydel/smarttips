import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ActionItemSeverity, ActionItemStatus, ActionItemType, AuditAction } from '@prisma/client';

import { ActionInboxService } from './action-inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ITEM_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function buildItemView(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    type: ActionItemType.DISTRIBUTION_MISSING,
    severity: ActionItemSeverity.CRITICAL,
    status: ActionItemStatus.OPEN,
    title: 'Distribution à lancer · Dîner du 2026-06-08',
    entityType: 'Shift',
    entityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    shiftId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    payload: { shiftDate: '2026-06-08' },
    resolutionNote: null,
    resolvedAt: null,
    createdAt: new Date('2026-06-09T00:00:00Z'),
    updatedAt: new Date('2026-06-09T00:00:00Z'),
    ...overrides,
  };
}

describe('ActionInboxService', () => {
  let service: ActionInboxService;

  const mockPrisma = {
    actionItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAudit = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionInboxService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ActionInboxService>(ActionInboxService);
  });

  describe('list', () => {
    it('always scopes the query to the tenant', async () => {
      mockPrisma.$transaction.mockResolvedValue([[buildItemView()], 1]);

      await service.list(TENANT_ID, {});

      expect(mockPrisma.actionItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
      expect(mockPrisma.actionItem.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      });
    });

    it('applies status, severity, type and shift filters', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      const shiftId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

      await service.list(TENANT_ID, {
        status: [ActionItemStatus.OPEN],
        severity: [ActionItemSeverity.CRITICAL, ActionItemSeverity.WARNING],
        type: [ActionItemType.SHIFT_UNASSIGNED],
        shiftId,
      });

      expect(mockPrisma.actionItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_ID,
            status: { in: [ActionItemStatus.OPEN] },
            severity: { in: [ActionItemSeverity.CRITICAL, ActionItemSeverity.WARNING] },
            type: { in: [ActionItemType.SHIFT_UNASSIGNED] },
            shiftId,
          },
        }),
      );
    });

    it('orders by severity desc then createdAt desc and paginates', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.list(TENANT_ID, { limit: 10, offset: 20 });

      expect(mockPrisma.actionItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
          take: 10,
          skip: 20,
        }),
      );
      expect(result).toEqual({ items: [], total: 0, limit: 10, offset: 20 });
    });
  });

  describe('updateStatus', () => {
    it('resolves an OPEN item and writes ACTION_ITEM_RESOLVED audit', async () => {
      mockPrisma.actionItem.findFirst
        .mockResolvedValueOnce({ id: ITEM_ID, status: ActionItemStatus.OPEN })
        .mockResolvedValueOnce(
          buildItemView({ status: ActionItemStatus.RESOLVED, resolutionNote: 'Fait.' }),
        );
      mockPrisma.actionItem.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateStatus(TENANT_ID, USER_ID, ITEM_ID, {
        status: ActionItemStatus.RESOLVED,
        note: 'Fait.',
      });

      expect(mockPrisma.actionItem.updateMany).toHaveBeenCalledWith({
        where: { id: ITEM_ID, tenantId: TENANT_ID, status: ActionItemStatus.OPEN },
        data: expect.objectContaining({
          status: ActionItemStatus.RESOLVED,
          resolutionNote: 'Fait.',
          resolvedById: USER_ID,
        }),
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          action: AuditAction.ACTION_ITEM_RESOLVED,
          entityType: 'ActionItem',
          entityId: ITEM_ID,
          oldValues: { status: ActionItemStatus.OPEN },
          newValues: { status: ActionItemStatus.RESOLVED, resolutionNote: 'Fait.' },
          metadata: { reason: 'manual' },
        }),
      );
      expect(result.status).toBe(ActionItemStatus.RESOLVED);
    });

    it('dismisses an OPEN item and writes ACTION_ITEM_DISMISSED audit', async () => {
      mockPrisma.actionItem.findFirst
        .mockResolvedValueOnce({ id: ITEM_ID, status: ActionItemStatus.OPEN })
        .mockResolvedValueOnce(buildItemView({ status: ActionItemStatus.DISMISSED }));
      mockPrisma.actionItem.updateMany.mockResolvedValue({ count: 1 });

      await service.updateStatus(TENANT_ID, USER_ID, ITEM_ID, {
        status: ActionItemStatus.DISMISSED,
      });

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ACTION_ITEM_DISMISSED,
          newValues: { status: ActionItemStatus.DISMISSED, resolutionNote: null },
        }),
      );
    });

    it('returns 404 when the item does not exist for this tenant (cross-tenant probe)', async () => {
      // L'item existe chez OTHER_TENANT_ID mais findFirst est filtré par tenantId.
      mockPrisma.actionItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, ITEM_ID, {
          status: ActionItemStatus.RESOLVED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(mockPrisma.actionItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ITEM_ID, tenantId: TENANT_ID } }),
      );
      expect(mockPrisma.actionItem.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ITEM_ID, tenantId: OTHER_TENANT_ID } }),
      );
      expect(mockPrisma.actionItem.updateMany).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rejects transitions from RESOLVED', async () => {
      mockPrisma.actionItem.findFirst.mockResolvedValue({
        id: ITEM_ID,
        status: ActionItemStatus.RESOLVED,
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, ITEM_ID, {
          status: ActionItemStatus.DISMISSED,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockPrisma.actionItem.updateMany).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rejects transitions from DISMISSED', async () => {
      mockPrisma.actionItem.findFirst.mockResolvedValue({
        id: ITEM_ID,
        status: ActionItemStatus.DISMISSED,
      });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, ITEM_ID, {
          status: ActionItemStatus.RESOLVED,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when a concurrent update already changed the status', async () => {
      mockPrisma.actionItem.findFirst.mockResolvedValue({
        id: ITEM_ID,
        status: ActionItemStatus.OPEN,
      });
      mockPrisma.actionItem.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, ITEM_ID, {
          status: ActionItemStatus.RESOLVED,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });
});
