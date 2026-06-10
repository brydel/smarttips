import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeRole, Prisma, TipPoolStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { WalletRange } from './dto/employee-wallet-query.dto';
import {
  EmployeeDashboardSummaryView,
  EmployeeLastShiftView,
  EmployeeShiftRecordView,
  EmployeeWalletExplanation,
  EmployeeWalletStatus,
} from './types/employee-wallet.types';

const RANGE_DAYS: Record<WalletRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

/** Garde-fou volume : l'historique V1 n'est pas paginé. */
const MAX_RECORDS = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clés d'explication exposables à l'employé (liste blanche stricte).
 * Jamais de spread du JSON brut : les internals moteur (source, schemaVersion,
 * engineVersion, policyVersion) et ML (modelVersion, mlWeight, mlShare,
 * rulesShare, blendAlpha) ne doivent pas sortir.
 */
const EXPLANATION_STRING_KEYS = [
  'roleCoefficient',
  'employeeCoefficient',
  'hoursWorked',
  'salesGenerated',
  'shiftAvgSales',
  'salesBonus',
  'baseScore',
  'rawScore',
  'scoreShare',
  'rawAmount',
  'capAmount',
  'minAmount',
  'finalAmount',
] as const;

const EXPLANATION_BOOLEAN_KEYS = ['capApplied', 'minimumApplied'] as const;

/** Date civile UTC (les shifts utilisent @db.Date, minuit UTC). */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Borne basse incluse d'une fenêtre de N jours se terminant aujourd'hui. */
function rangeCutoff(days: number, now: Date): Date {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayUtc - (days - 1) * DAY_MS);
}

const WALLET_ROW_SELECT = {
  id: true,
  amount: true,
  contributionScore: true,
  computationMethod: true,
  explanation: true,
  paidAt: true,
  acknowledgedAt: true,
  tipPool: {
    select: {
      status: true,
      shift: {
        select: {
          id: true,
          date: true,
          shiftType: true,
        },
      },
    },
  },
} satisfies Prisma.TipDistributionSelect;

type WalletRow = Prisma.TipDistributionGetPayload<{ select: typeof WALLET_ROW_SELECT }>;

@Injectable()
export class EmployeeWalletService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /employee/me/distributions
   * Historique des pourboires de l'employé authentifié uniquement.
   */
  async getDistributions(
    tenantId: string,
    userId: string,
    range: WalletRange = '30d',
  ): Promise<EmployeeShiftRecordView[]> {
    const employee = await this.resolveEmployee(tenantId, userId);
    const days = RANGE_DAYS[range];
    const cutoff = days === null ? null : rangeCutoff(days, new Date());

    const rows = await this.fetchRows(tenantId, employee.id, cutoff);
    const hours = await this.fetchAssignmentHours(
      tenantId,
      employee.id,
      rows.map((row) => row.tipPool.shift.id),
    );

    return rows.map((row) => this.toShiftRecord(row, employee.role, hours));
  }

  /**
   * GET /employee/me/dashboard
   * Synthèse 7/30 jours + tendance + dernier shift, pour l'employé authentifié.
   */
  async getDashboard(tenantId: string, userId: string): Promise<EmployeeDashboardSummaryView> {
    const employee = await this.resolveEmployee(tenantId, userId);
    const now = new Date();
    const cutoff30 = rangeCutoff(30, now);
    const weekCutoffIso = isoDate(rangeCutoff(7, now));

    const rows = await this.fetchRows(tenantId, employee.id, cutoff30);
    const hours = await this.fetchAssignmentHours(
      tenantId,
      employee.id,
      rows.map((row) => row.tipPool.shift.id),
    );

    let weekTotal = new Prisma.Decimal(0);
    let monthTotal = new Prisma.Decimal(0);
    const byDate = new Map<string, Prisma.Decimal>();

    for (const row of rows) {
      const dateIso = isoDate(row.tipPool.shift.date);
      monthTotal = monthTotal.add(row.amount);
      if (dateIso >= weekCutoffIso) {
        weekTotal = weekTotal.add(row.amount);
      }
      byDate.set(dateIso, (byDate.get(dateIso) ?? new Prisma.Decimal(0)).add(row.amount));
    }

    // 30 points, jours sans distribution à zéro : axe stable côté graphe.
    const trend30Days = Array.from({ length: 30 }, (_, i) => {
      const dateIso = isoDate(new Date(cutoff30.getTime() + i * DAY_MS));
      return {
        date: dateIso,
        amount: Number(byDate.get(dateIso)?.toFixed(2) ?? 0),
      };
    });

    const count = rows.length;
    const lastRow = rows[0];

    return {
      weekTotal: weekTotal.toFixed(2),
      monthTotal: monthTotal.toFixed(2),
      monthShiftCount: count,
      averagePerShift: count > 0 ? monthTotal.div(count).toFixed(2) : '0.00',
      trend30Days,
      lastShift: lastRow ? this.toLastShift(lastRow, employee.role, hours) : null,
    };
  }

  /**
   * Lie l'utilisateur authentifié à SON dossier employé.
   * L'employeeId ne vient jamais de la requête.
   */
  private async resolveEmployee(
    tenantId: string,
    userId: string,
  ): Promise<{ id: string; role: EmployeeRole }> {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true, role: true },
    });

    if (!employee) {
      throw new NotFoundException('error.employee.notLinked');
    }

    return employee;
  }

  /**
   * Distributions de l'employé sur pools calculés ou finalisés uniquement.
   * DECLARED n'a pas encore de distribution ; VOIDED est exclu (annulé).
   */
  private fetchRows(tenantId: string, employeeId: string, cutoff: Date | null) {
    return this.prisma.tipDistribution.findMany({
      where: {
        tenantId,
        employeeId,
        deletedAt: null,
        tipPool: {
          deletedAt: null,
          status: { in: [TipPoolStatus.DISTRIBUTED, TipPoolStatus.FINALIZED] },
          shift: {
            deletedAt: null,
            ...(cutoff ? { date: { gte: cutoff } } : {}),
          },
        },
      },
      select: WALLET_ROW_SELECT,
      orderBy: [{ tipPool: { shift: { date: 'desc' } } }, { createdAt: 'desc' }],
      take: MAX_RECORDS,
    });
  }

  /** Heures travaillées de l'employé par shift (sa propre assignation seulement). */
  private async fetchAssignmentHours(
    tenantId: string,
    employeeId: string,
    shiftIds: string[],
  ): Promise<Map<string, { role: EmployeeRole; hoursWorked: string | null }>> {
    if (shiftIds.length === 0) {
      return new Map();
    }

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        tenantId,
        employeeId,
        shiftId: { in: shiftIds },
        deletedAt: null,
      },
      select: { shiftId: true, roleDuringShift: true, hoursWorked: true },
    });

    return new Map(
      assignments.map((assignment) => [
        assignment.shiftId,
        {
          role: assignment.roleDuringShift,
          hoursWorked: assignment.hoursWorked?.toFixed(2) ?? null,
        },
      ]),
    );
  }

  private toShiftRecord(
    row: WalletRow,
    fallbackRole: EmployeeRole,
    hoursByShift: Map<string, { role: EmployeeRole; hoursWorked: string | null }>,
  ): EmployeeShiftRecordView {
    const shift = row.tipPool.shift;
    const assignment = hoursByShift.get(shift.id);
    const explanation = this.redactExplanation(row.explanation);

    return {
      id: row.id,
      shiftId: shift.id,
      date: isoDate(shift.date),
      shiftType: shift.shiftType,
      role: assignment?.role ?? fallbackRole,
      hoursWorked: assignment?.hoursWorked ?? explanation?.hoursWorked ?? null,
      salesGenerated: explanation?.salesGenerated ?? null,
      contributionScore: row.contributionScore.toString(),
      amount: row.amount.toFixed(2),
      poolSharePct: explanation?.scoreShare ?? null,
      status: row.tipPool.status as EmployeeWalletStatus,
      paidAt: row.paidAt?.toISOString() ?? null,
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      explanation,
    };
  }

  private toLastShift(
    row: WalletRow,
    fallbackRole: EmployeeRole,
    hoursByShift: Map<string, { role: EmployeeRole; hoursWorked: string | null }>,
  ): EmployeeLastShiftView {
    const record = this.toShiftRecord(row, fallbackRole, hoursByShift);

    return {
      shiftId: record.shiftId,
      date: record.date,
      shiftType: record.shiftType,
      role: record.role,
      hoursWorked: record.hoursWorked,
      amount: record.amount,
      computationMethod: row.computationMethod,
      explanation: record.explanation,
    };
  }

  /**
   * Copie clé par clé sur liste blanche — jamais de spread du JSON brut.
   * Les lignes ML ne livrent que les champs de base (part, montants, plafonds).
   */
  private redactExplanation(value: Prisma.JsonValue): EmployeeWalletExplanation | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const raw = value as Record<string, unknown>;
    const out: EmployeeWalletExplanation = {};

    for (const key of EXPLANATION_STRING_KEYS) {
      const candidate = raw[key];
      if (typeof candidate === 'string') {
        out[key] = candidate;
      }
    }

    for (const key of EXPLANATION_BOOLEAN_KEYS) {
      const candidate = raw[key];
      if (typeof candidate === 'boolean') {
        out[key] = candidate;
      }
    }

    if (typeof raw.roundingAdjustmentCents === 'number') {
      out.roundingAdjustmentCents = raw.roundingAdjustmentCents;
    }

    return Object.keys(out).length > 0 ? out : null;
  }
}
