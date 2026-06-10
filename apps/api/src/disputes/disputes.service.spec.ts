import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuditAction,
  ComputationMethod,
  EmployeeRole,
  Prisma,
  ShiftType,
  TipDisputeCategory,
  TipDisputeOutcome,
  TipDisputeStatus,
  TipPoolStatus,
} from '@prisma/client';

import { DisputesService } from './disputes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPLOYEE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DISTRIBUTION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const DISPUTE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SHIFT_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const MANAGER_ID = '99999999-9999-4999-8999-999999999999';

/** Explication brute persistée : contient des internals qui doivent être redactés. */
const RAW_EXPLANATION = {
  source: 'ML_FULL',
  schemaVersion: 1,
  engineVersion: 'distribution-engine-v1',
  policyVersion: 'policy-test',
  modelVersion: 3,
  mlWeight: '0.8000',
  mlShare: '0.5000',
  scoreShare: '0.2500',
  rawAmount: '25.00',
  finalAmount: '25.00',
  hoursWorked: '6.0000',
  capApplied: false,
  minimumApplied: false,
  roundingAdjustmentCents: 0,
};

function buildDistribution(overrides: Record<string, unknown> = {}) {
  return {
    id: DISTRIBUTION_ID,
    amount: new Prisma.Decimal('25.00'),
    contributionScore: new Prisma.Decimal('6.93'),
    computationMethod: ComputationMethod.ML_FULL,
    explanation: RAW_EXPLANATION,
    tipPool: {
      status: TipPoolStatus.DISTRIBUTED,
      shift: {
        id: SHIFT_ID,
        date: new Date('2026-06-08T00:00:00.000Z'),
        shiftType: ShiftType.DINNER,
      },
    },
    ...overrides,
  };
}

function buildDisputeView(overrides: Record<string, unknown> = {}) {
  return {
    id: DISPUTE_ID,
    tipDistributionId: DISTRIBUTION_ID,
    category: TipDisputeCategory.AMOUNT,
    message: 'Je pense que mes heures ne sont pas correctes.',
    status: TipDisputeStatus.OPEN,
    outcome: null,
    resolutionNote: null,
    evidenceSnapshot: {},
    reviewStartedAt: null,
    resolvedAt: null,
    withdrawnAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('DisputesService', () => {
  let service: DisputesService;

  const mockPrisma = {
    employee: { findFirst: jest.fn() },
    tipDistribution: { findFirst: jest.fn() },
    shiftAssignment: { findFirst: jest.fn() },
    tipDispute: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE_ID });
    mockPrisma.tipDistribution.findFirst.mockResolvedValue(buildDistribution());
    mockPrisma.shiftAssignment.findFirst.mockResolvedValue({
      roleDuringShift: EmployeeRole.SERVER,
      hoursWorked: new Prisma.Decimal('6.00'),
    });
    mockPrisma.tipDispute.findFirst.mockResolvedValue(null);
    mockPrisma.tipDispute.findMany.mockResolvedValue([]);
    mockPrisma.tipDispute.create.mockResolvedValue(buildDisputeView());
    mockPrisma.tipDispute.updateMany.mockResolvedValue({ count: 1 });
    mockAudit.log.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);
  });

  const createDto = {
    tipDistributionId: DISTRIBUTION_ID,
    category: TipDisputeCategory.AMOUNT,
    message: 'Je pense que mes heures ne sont pas correctes.',
  };

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates an OPEN dispute with an immutable redacted evidence snapshot', async () => {
      await service.create(TENANT_ID, USER_ID, createDto);

      const data = mockPrisma.tipDispute.create.mock.calls[0][0].data;
      expect(data.status).toBe(TipDisputeStatus.OPEN);
      expect(data.employeeId).toBe(EMPLOYEE_ID);

      const snapshot = data.evidenceSnapshot;
      expect(snapshot.amount).toBe('25.00');
      expect(snapshot.shiftId).toBe(SHIFT_ID);
      expect(snapshot.shiftDate).toBe('2026-06-08');
      expect(snapshot.hoursWorked).toBe('6.00');
      expect(snapshot.roleDuringShift).toBe(EmployeeRole.SERVER);

      // Explication redactée par liste blanche : jamais d'internals moteur/ML.
      expect(snapshot.explanation).toMatchObject({
        scoreShare: '0.2500',
        finalAmount: '25.00',
        hoursWorked: '6.0000',
      });
      expect(snapshot.explanation).not.toHaveProperty('source');
      expect(snapshot.explanation).not.toHaveProperty('mlWeight');
      expect(snapshot.explanation).not.toHaveProperty('mlShare');
      expect(snapshot.explanation).not.toHaveProperty('modelVersion');
      expect(snapshot.explanation).not.toHaveProperty('engineVersion');
    });

    it('never includes coworker data in the snapshot (own assignment only)', async () => {
      await service.create(TENANT_ID, USER_ID, createDto);

      expect(mockPrisma.shiftAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, employeeId: EMPLOYEE_ID }),
        }),
      );
    });

    it('resolves the employee from JWT identity only (tenantId + userId)', async () => {
      await service.create(TENANT_ID, USER_ID, createDto);

      expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, userId: USER_ID, deletedAt: null },
        }),
      );
      // La distribution est scopée au tenant ET à l'employé résolu.
      expect(mockPrisma.tipDistribution.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, employeeId: EMPLOYEE_ID }),
        }),
      );
    });

    it('returns 404 when the distribution belongs to another employee or tenant', async () => {
      mockPrisma.tipDistribution.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, USER_ID, createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.tipDispute.create).not.toHaveBeenCalled();
    });

    it('returns 409 error.dispute.alreadyActive when an active dispute exists', async () => {
      mockPrisma.tipDispute.findFirst.mockResolvedValue({ id: DISPUTE_ID });

      await expect(service.create(TENANT_ID, USER_ID, createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.tipDispute.create).not.toHaveBeenCalled();
    });

    it('audits DISPUTE_OPENED with safe metadata only — never the message text', async () => {
      await service.create(TENANT_ID, USER_ID, createDto);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DISPUTE_OPENED,
          entityType: 'TipDispute',
        }),
      );

      const logged = JSON.stringify(mockAudit.log.mock.calls[0][0]);
      expect(logged).not.toContain(createDto.message);
    });

    it('returns 404 when the user has no linked employee record', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, USER_ID, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── listMine ────────────────────────────────────────────────────────────────

  describe('listMine', () => {
    it('scopes the list to the authenticated employee and tenant', async () => {
      await service.listMine(TENANT_ID, USER_ID);

      expect(mockPrisma.tipDispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, employeeId: EMPLOYEE_ID },
        }),
      );
    });
  });

  // ── withdraw ────────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    it('withdraws an OPEN dispute and audits the transition', async () => {
      mockPrisma.tipDispute.findFirst
        .mockResolvedValueOnce({ id: DISPUTE_ID, status: TipDisputeStatus.OPEN })
        .mockResolvedValueOnce(buildDisputeView({ status: TipDisputeStatus.WITHDRAWN }));

      const result = await service.withdraw(TENANT_ID, USER_ID, DISPUTE_ID);

      expect(result.status).toBe(TipDisputeStatus.WITHDRAWN);
      expect(mockPrisma.tipDispute.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: TipDisputeStatus.OPEN }),
          data: expect.objectContaining({ status: TipDisputeStatus.WITHDRAWN }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.DISPUTE_WITHDRAWN }),
      );
    });

    it('blocks withdrawal once the dispute is IN_REVIEW', async () => {
      mockPrisma.tipDispute.findFirst.mockResolvedValue({
        id: DISPUTE_ID,
        status: TipDisputeStatus.IN_REVIEW,
      });

      await expect(service.withdraw(TENANT_ID, USER_ID, DISPUTE_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.tipDispute.updateMany).not.toHaveBeenCalled();
    });

    it("returns 404 for another employee's dispute", async () => {
      mockPrisma.tipDispute.findFirst.mockResolvedValue(null);

      await expect(service.withdraw(TENANT_ID, USER_ID, DISPUTE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── manager: list / getById ─────────────────────────────────────────────────

  describe('list', () => {
    it('filters by tenant, status and category', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.list(TENANT_ID, {
        status: [TipDisputeStatus.OPEN],
        category: [TipDisputeCategory.HOURS],
      });

      expect(result).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
      expect(mockPrisma.tipDispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_ID,
            status: { in: [TipDisputeStatus.OPEN] },
            category: { in: [TipDisputeCategory.HOURS] },
          },
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns 404 when the dispute belongs to another tenant', async () => {
      mockPrisma.tipDispute.findFirst.mockResolvedValue(null);

      await expect(service.getById(TENANT_ID, DISPUTE_ID)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.tipDispute.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: DISPUTE_ID, tenantId: TENANT_ID } }),
      );
    });
  });

  // ── manager: startReview ────────────────────────────────────────────────────

  describe('startReview', () => {
    it('transitions OPEN → IN_REVIEW and audits DISPUTE_REVIEW_STARTED', async () => {
      mockPrisma.tipDispute.findFirst
        .mockResolvedValueOnce({ id: DISPUTE_ID, status: TipDisputeStatus.OPEN })
        .mockResolvedValueOnce(buildDisputeView({ status: TipDisputeStatus.IN_REVIEW }));

      const result = await service.startReview(TENANT_ID, MANAGER_ID, DISPUTE_ID);

      expect(result.status).toBe(TipDisputeStatus.IN_REVIEW);
      expect(mockPrisma.tipDispute.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TipDisputeStatus.IN_REVIEW,
            reviewedById: MANAGER_ID,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.DISPUTE_REVIEW_STARTED }),
      );
    });

    it.each([
      [TipDisputeStatus.IN_REVIEW],
      [TipDisputeStatus.RESOLVED],
      [TipDisputeStatus.WITHDRAWN],
    ])('rejects review from %s', async (status) => {
      mockPrisma.tipDispute.findFirst.mockResolvedValue({ id: DISPUTE_ID, status });

      await expect(service.startReview(TENANT_ID, MANAGER_ID, DISPUTE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── manager: resolve ────────────────────────────────────────────────────────

  describe('resolve', () => {
    const resolveDto = {
      outcome: TipDisputeOutcome.EXPLAINED,
      resolutionNote: 'Explication fournie : le calcul reflète les heures pointées.',
    };

    it.each([[TipDisputeStatus.OPEN], [TipDisputeStatus.IN_REVIEW]])(
      'resolves from %s with outcome and required note',
      async (status) => {
        mockPrisma.tipDispute.findFirst
          .mockResolvedValueOnce({ id: DISPUTE_ID, status })
          .mockResolvedValueOnce(
            buildDisputeView({
              status: TipDisputeStatus.RESOLVED,
              outcome: TipDisputeOutcome.EXPLAINED,
              resolutionNote: resolveDto.resolutionNote,
            }),
          );

        const result = await service.resolve(TENANT_ID, MANAGER_ID, DISPUTE_ID, resolveDto);

        expect(result.status).toBe(TipDisputeStatus.RESOLVED);
        expect(mockPrisma.tipDispute.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: TipDisputeStatus.RESOLVED,
              outcome: TipDisputeOutcome.EXPLAINED,
              resolutionNote: resolveDto.resolutionNote,
              resolvedById: MANAGER_ID,
            }),
          }),
        );
      },
    );

    it('never mutates payout or distribution amounts on any transition', async () => {
      mockPrisma.tipDispute.findFirst
        .mockResolvedValueOnce({ id: DISPUTE_ID, status: TipDisputeStatus.IN_REVIEW })
        .mockResolvedValueOnce(buildDisputeView({ status: TipDisputeStatus.RESOLVED }));

      await service.resolve(TENANT_ID, MANAGER_ID, DISPUTE_ID, {
        outcome: TipDisputeOutcome.MANUAL_FOLLOW_UP,
        resolutionNote: 'Suivi manuel planifié avec la paie.',
      });

      // Seule la table tip_disputes est touchée : jamais tipDistribution/tipPool.
      expect(mockPrisma.tipDistribution.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.tipDispute.updateMany).toHaveBeenCalledTimes(1);
    });

    it.each([[TipDisputeStatus.RESOLVED], [TipDisputeStatus.WITHDRAWN]])(
      'rejects resolution from %s (no reopen in V1)',
      async (status) => {
        mockPrisma.tipDispute.findFirst.mockResolvedValue({ id: DISPUTE_ID, status });

        await expect(
          service.resolve(TENANT_ID, MANAGER_ID, DISPUTE_ID, resolveDto),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('audits DISPUTE_RESOLVED with outcome but never the note text', async () => {
      mockPrisma.tipDispute.findFirst
        .mockResolvedValueOnce({ id: DISPUTE_ID, status: TipDisputeStatus.IN_REVIEW })
        .mockResolvedValueOnce(buildDisputeView({ status: TipDisputeStatus.RESOLVED }));

      await service.resolve(TENANT_ID, MANAGER_ID, DISPUTE_ID, resolveDto);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DISPUTE_RESOLVED,
          newValues: { status: TipDisputeStatus.RESOLVED, outcome: TipDisputeOutcome.EXPLAINED },
        }),
      );

      const logged = JSON.stringify(mockAudit.log.mock.calls[0][0]);
      expect(logged).not.toContain(resolveDto.resolutionNote);
    });
  });
});
