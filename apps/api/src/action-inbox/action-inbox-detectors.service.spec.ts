import { Test, TestingModule } from '@nestjs/testing';
import {
  ActionItemSeverity,
  ActionItemStatus,
  ActionItemType,
  AuditAction,
  ShiftType,
  TipPoolStatus,
} from '@prisma/client';

import { ActionInboxDetectorsService } from './action-inbox-detectors.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SHIFT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const POOL_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const EXISTING_ITEM_ID = '99999999-9999-4999-8999-999999999999';

const closedShiftWithoutPool = {
  id: SHIFT_ID,
  date: new Date('2026-06-08T00:00:00Z'),
  shiftType: ShiftType.DINNER,
  tipPool: null,
};

describe('ActionInboxDetectorsService', () => {
  let service: ActionInboxDetectorsService;

  const mockPrisma = {
    shift: { findMany: jest.fn() },
    tipPool: { findMany: jest.fn() },
    actionItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };

  /** Par défaut : aucune condition détectée, aucun item existant. */
  function resetToEmpty() {
    mockPrisma.shift.findMany.mockResolvedValue([]);
    mockPrisma.tipPool.findMany.mockResolvedValue([]);
    mockPrisma.actionItem.findMany.mockResolvedValue([]);
    mockPrisma.actionItem.create.mockResolvedValue({ id: EXISTING_ITEM_ID });
    mockPrisma.actionItem.update.mockResolvedValue({});
    mockPrisma.actionItem.count.mockResolvedValue(0);
  }

  /** Fait détecter DISTRIBUTION_MISSING sur SHIFT_ID (1er appel shift.findMany). */
  function detectDistributionMissingOnly() {
    mockPrisma.shift.findMany
      .mockResolvedValueOnce([closedShiftWithoutPool]) // DISTRIBUTION_MISSING
      .mockResolvedValueOnce([]) // SHIFT_CLOSE_OVERDUE
      .mockResolvedValueOnce([]); // SHIFT_UNASSIGNED
    mockPrisma.tipPool.findMany.mockResolvedValue([]);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    resetToEmpty();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionInboxDetectorsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ActionInboxDetectorsService>(ActionInboxDetectorsService);
  });

  it('creates an item with audit when a condition is detected for the first time', async () => {
    detectDistributionMissingOnly();

    const result = await service.refresh(TENANT_ID, USER_ID);

    expect(mockPrisma.actionItem.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          type: ActionItemType.DISTRIBUTION_MISSING,
          severity: ActionItemSeverity.CRITICAL,
          entityType: 'Shift',
          entityId: SHIFT_ID,
          shiftId: SHIFT_ID,
          dedupeKey: `${ActionItemType.DISTRIBUTION_MISSING}:${SHIFT_ID}`,
        }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        action: AuditAction.ACTION_ITEM_CREATED,
        entityType: 'ActionItem',
        metadata: { source: 'detector' },
      }),
    );
    expect(result.created).toBe(1);
  });

  it('does not store sensitive data in the payload (ids, dates, counts only)', async () => {
    detectDistributionMissingOnly();

    await service.refresh(TENANT_ID, USER_ID);

    const data = mockPrisma.actionItem.create.mock.calls[0][0].data;
    expect(data.payload).toEqual({
      shiftDate: '2026-06-08',
      shiftType: ShiftType.DINNER,
      hasTipPool: false,
      tipPoolStatus: null,
    });
  });

  it('is idempotent: a second run on the same condition creates no duplicate', async () => {
    detectDistributionMissingOnly();
    mockPrisma.actionItem.findMany.mockResolvedValue([
      {
        id: EXISTING_ITEM_ID,
        dedupeKey: `${ActionItemType.DISTRIBUTION_MISSING}:${SHIFT_ID}`,
        status: ActionItemStatus.OPEN,
        type: ActionItemType.DISTRIBUTION_MISSING,
      },
    ]);

    const result = await service.refresh(TENANT_ID, USER_ID);

    expect(mockPrisma.actionItem.create).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    // L'évidence de l'item OPEN est rafraîchie silencieusement, sans audit.
    expect(mockPrisma.actionItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: EXISTING_ITEM_ID } }),
    );
    expect(mockAudit.log).not.toHaveBeenCalled();
  });

  it('never resurrects a DISMISSED item even if the condition is still true', async () => {
    detectDistributionMissingOnly();
    mockPrisma.actionItem.findMany.mockResolvedValue([
      {
        id: EXISTING_ITEM_ID,
        dedupeKey: `${ActionItemType.DISTRIBUTION_MISSING}:${SHIFT_ID}`,
        status: ActionItemStatus.DISMISSED,
        type: ActionItemType.DISTRIBUTION_MISSING,
      },
    ]);

    const result = await service.refresh(TENANT_ID, USER_ID);

    expect(mockPrisma.actionItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.actionItem.update).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
  });

  it('never reopens a manually RESOLVED item even if the condition is still true', async () => {
    detectDistributionMissingOnly();
    mockPrisma.actionItem.findMany.mockResolvedValue([
      {
        id: EXISTING_ITEM_ID,
        dedupeKey: `${ActionItemType.DISTRIBUTION_MISSING}:${SHIFT_ID}`,
        status: ActionItemStatus.RESOLVED,
        type: ActionItemType.DISTRIBUTION_MISSING,
      },
    ]);

    await service.refresh(TENANT_ID, USER_ID);

    expect(mockPrisma.actionItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.actionItem.update).not.toHaveBeenCalled();
  });

  it('auto-resolves an OPEN item whose condition cleared, with audit reason "auto"', async () => {
    // Aucune condition détectée, mais un item OPEN existe encore.
    mockPrisma.actionItem.findMany.mockResolvedValue([
      {
        id: EXISTING_ITEM_ID,
        dedupeKey: `${ActionItemType.SHIFT_UNASSIGNED}:${SHIFT_ID}`,
        status: ActionItemStatus.OPEN,
        type: ActionItemType.SHIFT_UNASSIGNED,
      },
    ]);

    const result = await service.refresh(TENANT_ID, USER_ID);

    expect(mockPrisma.actionItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EXISTING_ITEM_ID },
        data: expect.objectContaining({
          status: ActionItemStatus.RESOLVED,
          resolvedById: null,
        }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ACTION_ITEM_RESOLVED,
        entityId: EXISTING_ITEM_ID,
        oldValues: { status: ActionItemStatus.OPEN },
        newValues: { status: ActionItemStatus.RESOLVED },
        metadata: { reason: 'auto' },
      }),
    );
    expect(result.autoResolved).toBe(1);
  });

  it('does not auto-resolve DISMISSED items whose condition cleared', async () => {
    mockPrisma.actionItem.findMany.mockResolvedValue([
      {
        id: EXISTING_ITEM_ID,
        dedupeKey: `${ActionItemType.SHIFT_UNASSIGNED}:${SHIFT_ID}`,
        status: ActionItemStatus.DISMISSED,
        type: ActionItemType.SHIFT_UNASSIGNED,
      },
    ]);

    const result = await service.refresh(TENANT_ID, USER_ID);

    expect(mockPrisma.actionItem.update).not.toHaveBeenCalled();
    expect(result.autoResolved).toBe(0);
  });

  it('scopes every detector query to the tenant', async () => {
    mockPrisma.tipPool.findMany.mockResolvedValue([
      {
        id: POOL_ID,
        shiftId: SHIFT_ID,
        shift: { date: new Date('2026-06-08T00:00:00Z'), shiftType: ShiftType.DINNER },
        _count: { distributions: 4 },
      },
    ]);

    await service.refresh(TENANT_ID, USER_ID);

    for (const call of mockPrisma.shift.findMany.mock.calls) {
      expect(call[0].where.tenantId).toBe(TENANT_ID);
    }
    for (const call of mockPrisma.tipPool.findMany.mock.calls) {
      expect(call[0].where.tenantId).toBe(TENANT_ID);
    }
    // Le pool DISTRIBUTED produit un item DISTRIBUTION_PENDING_APPROVAL.
    expect(mockPrisma.actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: ActionItemType.DISTRIBUTION_PENDING_APPROVAL,
          entityType: 'TipPool',
          entityId: POOL_ID,
          shiftId: SHIFT_ID,
          dedupeKey: `${ActionItemType.DISTRIBUTION_PENDING_APPROVAL}:${POOL_ID}`,
        }),
      }),
    );
    expect(
      (mockPrisma.tipPool.findMany.mock.calls[0][0].where as { status: TipPoolStatus }).status,
    ).toBe(TipPoolStatus.DISTRIBUTED);
  });
});
