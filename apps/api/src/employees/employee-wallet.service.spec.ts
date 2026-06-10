import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComputationMethod, EmployeeRole, Prisma, ShiftType, TipPoolStatus } from '@prisma/client';

import { EmployeeWalletService } from './employee-wallet.service';
import { PrismaService } from '../prisma/prisma.service';

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPLOYEE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SHIFT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OLD_SHIFT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

/** Explication brute persistée : contient des internals qui doivent être redactés. */
const RAW_RULES_EXPLANATION = {
  source: 'RULES',
  schemaVersion: 1,
  engineVersion: 'distribution-engine-v1',
  policyVersion: 'policy-test',
  scoreShare: '0.2500',
  rawAmount: '25.00',
  capAmount: '35.00',
  minAmount: '8.00',
  capApplied: false,
  minimumApplied: false,
  roundingAdjustmentCents: 0,
  finalAmount: '25.00',
  roleCoefficient: '1.0000',
  employeeCoefficient: '1.1000',
  hoursWorked: '6.0000',
  salesGenerated: '420.00',
  shiftAvgSales: '380.00',
  salesBonus: '1.0500',
  baseScore: '6.6000',
  rawScore: '6.9300',
};

const RAW_ML_EXPLANATION = {
  source: 'ML_FULL',
  schemaVersion: 1,
  engineVersion: 'distribution-engine-v1',
  policyVersion: 'policy-test',
  scoreShare: '0.5000',
  rawAmount: '50.00',
  capAmount: '60.00',
  minAmount: '0.00',
  capApplied: false,
  minimumApplied: false,
  roundingAdjustmentCents: 0,
  finalAmount: '50.00',
  modelVersion: 3,
  mlWeight: '0.8000',
  mlShare: '0.5000',
};

function isoDaysAgo(days: number): Date {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayUtc - days * 24 * 60 * 60 * 1000);
}

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    amount: new Prisma.Decimal('25.00'),
    contributionScore: new Prisma.Decimal('6.93'),
    computationMethod: ComputationMethod.RULES,
    explanation: RAW_RULES_EXPLANATION,
    paidAt: null,
    acknowledgedAt: null,
    tipPool: {
      status: TipPoolStatus.DISTRIBUTED,
      shift: { id: SHIFT_ID, date: isoDaysAgo(1), shiftType: ShiftType.DINNER },
    },
    ...overrides,
  };
}

describe('EmployeeWalletService', () => {
  let service: EmployeeWalletService;

  const mockPrisma = {
    employee: { findFirst: jest.fn() },
    tipDistribution: { findMany: jest.fn() },
    shiftAssignment: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.employee.findFirst.mockResolvedValue({
      id: EMPLOYEE_ID,
      role: EmployeeRole.SERVER,
    });
    mockPrisma.tipDistribution.findMany.mockResolvedValue([]);
    mockPrisma.shiftAssignment.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeeWalletService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<EmployeeWalletService>(EmployeeWalletService);
  });

  describe('identity resolution', () => {
    it('resolves the employee from tenantId + userId only (never from input)', async () => {
      await service.getDistributions(TENANT_ID, USER_ID, '30d');

      expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, userId: USER_ID, deletedAt: null },
        select: { id: true, role: true },
      });
    });

    it('returns 404 when no active employee record is linked to the user', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.getDistributions(TENANT_ID, USER_ID, '30d')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.getDashboard(TENANT_ID, USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(mockPrisma.tipDistribution.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getDistributions', () => {
    it('queries only own rows on DISTRIBUTED/FINALIZED pools (VOIDED and DECLARED excluded)', async () => {
      await service.getDistributions(TENANT_ID, USER_ID, '30d');

      expect(mockPrisma.tipDistribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            employeeId: EMPLOYEE_ID,
            deletedAt: null,
            tipPool: expect.objectContaining({
              deletedAt: null,
              status: { in: [TipPoolStatus.DISTRIBUTED, TipPoolStatus.FINALIZED] },
            }),
          }),
        }),
      );
    });

    it('applies the date window for bounded ranges and none for "all"', async () => {
      await service.getDistributions(TENANT_ID, USER_ID, '7d');
      const boundedWhere = mockPrisma.tipDistribution.findMany.mock.calls[0][0].where;
      expect(boundedWhere.tipPool.shift.date).toEqual({ gte: expect.any(Date) });

      mockPrisma.tipDistribution.findMany.mockClear();

      await service.getDistributions(TENANT_ID, USER_ID, 'all');
      const unboundedWhere = mockPrisma.tipDistribution.findMany.mock.calls[0][0].where;
      expect(unboundedWhere.tipPool.shift.date).toBeUndefined();
    });

    it('redacts engine internals from RULES explanations (whitelist only)', async () => {
      mockPrisma.tipDistribution.findMany.mockResolvedValue([buildRow()]);

      const [record] = await service.getDistributions(TENANT_ID, USER_ID, '30d');

      expect(record.explanation).toEqual({
        scoreShare: '0.2500',
        rawAmount: '25.00',
        capAmount: '35.00',
        minAmount: '8.00',
        capApplied: false,
        minimumApplied: false,
        roundingAdjustmentCents: 0,
        finalAmount: '25.00',
        roleCoefficient: '1.0000',
        employeeCoefficient: '1.1000',
        hoursWorked: '6.0000',
        salesGenerated: '420.00',
        shiftAvgSales: '380.00',
        salesBonus: '1.0500',
        baseScore: '6.6000',
        rawScore: '6.9300',
      });
      // Internals moteur jamais exposés.
      expect(record.explanation).not.toHaveProperty('source');
      expect(record.explanation).not.toHaveProperty('engineVersion');
      expect(record.explanation).not.toHaveProperty('policyVersion');
      expect(record.explanation).not.toHaveProperty('schemaVersion');
    });

    it('redacts ML internals from ML explanations', async () => {
      mockPrisma.tipDistribution.findMany.mockResolvedValue([
        buildRow({
          explanation: RAW_ML_EXPLANATION,
          computationMethod: ComputationMethod.ML_FULL,
        }),
      ]);

      const [record] = await service.getDistributions(TENANT_ID, USER_ID, '30d');

      expect(record.explanation).not.toHaveProperty('modelVersion');
      expect(record.explanation).not.toHaveProperty('mlWeight');
      expect(record.explanation).not.toHaveProperty('mlShare');
      expect(record.explanation).toMatchObject({ scoreShare: '0.5000', finalAmount: '50.00' });
    });

    it('maps honest status codes and never fabricates payout data', async () => {
      mockPrisma.tipDistribution.findMany.mockResolvedValue([
        buildRow(),
        buildRow({
          id: '22222222-2222-4222-8222-222222222222',
          tipPool: {
            status: TipPoolStatus.FINALIZED,
            shift: { id: OLD_SHIFT_ID, date: isoDaysAgo(3), shiftType: ShiftType.LUNCH },
          },
        }),
      ]);

      const records = await service.getDistributions(TENANT_ID, USER_ID, '30d');

      expect(records[0].status).toBe(TipPoolStatus.DISTRIBUTED);
      expect(records[1].status).toBe(TipPoolStatus.FINALIZED);
      expect(records[0].paidAt).toBeNull();
      expect(records[0].poolSharePct).toBe('0.2500');
      expect(records[0].amount).toBe('25.00');
    });

    it('uses own assignment role/hours and falls back to the employee role', async () => {
      mockPrisma.tipDistribution.findMany.mockResolvedValue([buildRow()]);
      mockPrisma.shiftAssignment.findMany.mockResolvedValue([
        {
          shiftId: SHIFT_ID,
          roleDuringShift: EmployeeRole.BARTENDER,
          hoursWorked: new Prisma.Decimal('5.75'),
        },
      ]);

      const [record] = await service.getDistributions(TENANT_ID, USER_ID, '30d');

      expect(mockPrisma.shiftAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            employeeId: EMPLOYEE_ID,
            deletedAt: null,
          }),
        }),
      );
      expect(record.role).toBe(EmployeeRole.BARTENDER);
      expect(record.hoursWorked).toBe('5.75');

      // Fallback : aucune assignation trouvée → rôle du dossier employé.
      mockPrisma.shiftAssignment.findMany.mockResolvedValue([]);
      const [fallback] = await service.getDistributions(TENANT_ID, USER_ID, '30d');
      expect(fallback.role).toBe(EmployeeRole.SERVER);
      expect(fallback.hoursWorked).toBe('6.0000'); // depuis l'explication
    });
  });

  describe('getDashboard', () => {
    it('aggregates week/month totals, average and trend from real rows only', async () => {
      mockPrisma.tipDistribution.findMany.mockResolvedValue([
        buildRow({ amount: new Prisma.Decimal('30.00') }), // il y a 1 jour → semaine + mois
        buildRow({
          id: '22222222-2222-4222-8222-222222222222',
          amount: new Prisma.Decimal('20.00'),
          tipPool: {
            status: TipPoolStatus.FINALIZED,
            shift: { id: OLD_SHIFT_ID, date: isoDaysAgo(20), shiftType: ShiftType.LUNCH },
          },
        }), // il y a 20 jours → mois seulement
      ]);

      const summary = await service.getDashboard(TENANT_ID, USER_ID);

      expect(summary.weekTotal).toBe('30.00');
      expect(summary.monthTotal).toBe('50.00');
      expect(summary.monthShiftCount).toBe(2);
      expect(summary.averagePerShift).toBe('25.00');

      expect(summary.trend30Days).toHaveLength(30);
      const dayWithTip = summary.trend30Days.find(
        (point) => point.date === isoDaysAgo(1).toISOString().slice(0, 10),
      );
      expect(dayWithTip?.amount).toBe(30);
      const emptyDays = summary.trend30Days.filter((point) => point.amount === 0);
      expect(emptyDays).toHaveLength(28);

      expect(summary.lastShift).toMatchObject({
        shiftId: SHIFT_ID,
        shiftType: ShiftType.DINNER,
        amount: '30.00',
        computationMethod: ComputationMethod.RULES,
      });
      expect(summary.lastShift?.explanation).not.toHaveProperty('engineVersion');
    });

    it('returns an honest empty summary when the employee has no distributions', async () => {
      const summary = await service.getDashboard(TENANT_ID, USER_ID);

      expect(summary.weekTotal).toBe('0.00');
      expect(summary.monthTotal).toBe('0.00');
      expect(summary.monthShiftCount).toBe(0);
      expect(summary.averagePerShift).toBe('0.00');
      expect(summary.lastShift).toBeNull();
      expect(summary.trend30Days.every((point) => point.amount === 0)).toBe(true);
    });
  });
});
