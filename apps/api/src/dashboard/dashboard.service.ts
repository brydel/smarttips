import { Injectable, Logger } from '@nestjs/common';
import { EmployeeRole, OrderStatus, ShiftStatus, TipPoolStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsPeriod } from './dto/get-stats-query.dto';

// ── Internal helpers ────────────────────────────────────────────────────────

/** Returns [start, end] UTC Date range for a given period. */
function getPeriodRange(period: StatsPeriod): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  switch (period) {
    case StatsPeriod.TODAY: {
      const end = new Date(todayStart);
      end.setUTCDate(end.getUTCDate() + 1);
      return { start: todayStart, end };
    }
    case StatsPeriod.WEEK: {
      const dayOfWeek = now.getUTCDay();
      const weekStart = new Date(todayStart);
      weekStart.setUTCDate(todayStart.getUTCDate() - ((dayOfWeek + 6) % 7)); // ISO Monday
      const end = new Date(weekStart);
      end.setUTCDate(weekStart.getUTCDate() + 7);
      return { start: weekStart, end };
    }
    case StatsPeriod.MONTH: {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { start: monthStart, end };
    }
  }
}

/** Returns the previous equivalent period range (for delta calculations). */
function getPrevPeriodRange(period: StatsPeriod): { start: Date; end: Date } {
  const { start, end } = getPeriodRange(period);
  const diff = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - diff),
    end: new Date(start.getTime()),
  };
}

/** Format a DateTime field (stored as full timestamp) to HH:MM string. */
function toHHMM(dt: Date | null | undefined): string {
  if (!dt) return '--:--';
  const h = String(dt.getUTCHours()).padStart(2, '0');
  const m = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Fractional hours from a Date (UTC hours + minutes). */
function toHourFrac(dt: Date | null | undefined): number {
  if (!dt) return 0;
  return dt.getUTCHours() + dt.getUTCMinutes() / 60;
}

/** Returns the value on fulfilled, fallback on rejected — graceful degradation. */
function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

// ── Role colour mapping ─────────────────────────────────────────────────────
const ROLE_COLOR: Record<EmployeeRole, string> = {
  [EmployeeRole.SERVER]: '#6366F1',
  [EmployeeRole.BARTENDER]: '#D4A574',
  [EmployeeRole.BUSSER]: '#10B981',
  [EmployeeRole.COOK]: '#3A4366',
  [EmployeeRole.CHEF]: '#252D45',
  [EmployeeRole.HOST]: '#8892B0',
};

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public entry point ────────────────────────────────────────────────────

  async getStats(tenantId: string, period: StatsPeriod) {
    const { start, end } = getPeriodRange(period);
    const { start: prevStart, end: prevEnd } = getPrevPeriodRange(period);

    // Fire all independent queries in parallel — graceful degradation via allSettled
    const [
      ordersResult,
      prevOrdersResult,
      tipPoolsResult,
      liveShiftResult,
      tomorrowShiftsResult,
      topServersResult,
      roleTipsResult,
      closedShiftsWithoutPoolResult,
      incompleteAssignmentsResult,
      fairnessScoreResult,
      dailyTipsResult,
      activeEmployeesCountResult,
    ] = await Promise.allSettled([
      this.fetchOrderAggregates(tenantId, start, end),
      this.fetchOrderTotal(tenantId, prevStart, prevEnd),
      this.fetchTipPools(tenantId, start, end),
      this.fetchLiveShift(tenantId),
      this.fetchTomorrowShifts(tenantId),
      this.fetchTopServers(tenantId, start, end),
      this.fetchRoleTips(tenantId, start, end),
      this.fetchClosedShiftsWithoutPool(tenantId, start, end),
      this.fetchIncompleteAssignments(tenantId, start, end),
      this.computeFairnessScore(tenantId, start, end),
      this.fetchDailyTips(tenantId),
      this.countActiveEmployees(tenantId, start, end),
    ]);

    // Log any rejected sub-queries so failures are observable in prod
    const QUERY_NAMES = [
      'orders',
      'prevOrders',
      'tipPools',
      'liveShift',
      'tomorrowShifts',
      'topServers',
      'roleTips',
      'closedShiftsWithoutPool',
      'incompleteAssignments',
      'fairnessScore',
      'dailyTips',
      'activeEmployeesCount',
    ] as const;
    [
      ordersResult,
      prevOrdersResult,
      tipPoolsResult,
      liveShiftResult,
      tomorrowShiftsResult,
      topServersResult,
      roleTipsResult,
      closedShiftsWithoutPoolResult,
      incompleteAssignmentsResult,
      fairnessScoreResult,
      dailyTipsResult,
      activeEmployeesCountResult,
    ].forEach((r, i) => {
      if (r.status === 'rejected') {
        this.logger.warn(
          `Dashboard query "${QUERY_NAMES[i]}" rejected: ${(r.reason as Error)?.message ?? String(r.reason)}`,
        );
      }
    });

    const orders = unwrap(ordersResult, {
      total: 0,
      count: 0,
      hourlyOrders: [] as { closedAt: Date | null; totalAmount: unknown }[],
    });
    const prevOrders = unwrap(prevOrdersResult, { total: 0, count: 0 });
    const tipPools = unwrap(tipPoolsResult, [] as { id: string; totalAmount: unknown }[]);
    const liveShift = unwrap(liveShiftResult, null);
    const tomorrowShifts = unwrap(tomorrowShiftsResult, []);
    const topServers = unwrap(topServersResult, []);
    const roleTips = unwrap(
      roleTipsResult,
      [] as { amount: unknown; employee: { role: EmployeeRole } }[],
    );
    const closedShiftsWithoutPool = unwrap(
      closedShiftsWithoutPoolResult,
      [] as { id: string; shiftType: string; date: Date }[],
    );
    const incompleteAssignments = unwrap(
      incompleteAssignmentsResult,
      [] as {
        id: string;
        employeeId: string;
        employee: { firstName: string; lastName: string };
        shift: { id: string; shiftType: string; date: Date };
      }[],
    );
    const fairnessScore = unwrap(fairnessScoreResult, null);
    const dailyTips = unwrap(dailyTipsResult, []);
    const activeEmployeesCount = unwrap(activeEmployeesCountResult, 0);

    // ── Aggregate tip totals ──────────────────────────────────────────────
    const poolTotal = tipPools.reduce((s, p) => s + Number(p.totalAmount), 0);
    const orderTotal = orders.total;
    const tipsTotal = poolTotal > 0 ? poolTotal : orderTotal * 0.15;
    const prevTipsTotal = prevOrders.total * 0.15;
    const ticketMoyen = orders.count > 0 ? orderTotal / orders.count : 0;

    return {
      period,
      tipsTotal: parseFloat(tipsTotal.toFixed(2)),
      tipsCount: orders.count,
      prevTipsTotal: parseFloat(prevTipsTotal.toFixed(2)),
      ticketMoyen: parseFloat(ticketMoyen.toFixed(2)),
      activeEmployeesCount,
      fairnessScore,
      hourlySales: this.aggregateHourlySales(orders.hourlyOrders),
      dailyTips,
      topEmployees: topServers,
      roleBreakdown: this.buildRoleBreakdown(roleTips),
      alerts: this.buildAlerts(closedShiftsWithoutPool, incompleteAssignments),
      liveShift: liveShift ? this.formatLiveShift(liveShift) : null,
      tomorrowShifts: tomorrowShifts.map((s) => this.formatTomorrowShift(s)),
    };
  }

  // ── Private query helpers ─────────────────────────────────────────────────

  /** Returns aggregate total + count, plus a row-capped set for hourly breakdown. */
  private async fetchOrderAggregates(tenantId: string, start: Date, end: Date) {
    const where = {
      tenantId,
      deletedAt: null,
      status: OrderStatus.PAID,
      closedAt: { gte: start, lt: end },
    } as const;

    const [aggregate, hourlyOrders] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where,
        select: { closedAt: true, totalAmount: true },
        take: 5_000, // cap to avoid OOM on heavy periods
      }),
    ]);

    return {
      total: Number(aggregate._sum.totalAmount ?? 0),
      count: aggregate._count._all,
      hourlyOrders,
    };
  }

  /** Aggregate-only query for prev period (delta computation, no rows needed). */
  private async fetchOrderTotal(tenantId: string, start: Date, end: Date) {
    const result = await this.prisma.order.aggregate({
      where: {
        tenantId,
        deletedAt: null,
        status: OrderStatus.PAID,
        closedAt: { gte: start, lt: end },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });
    return {
      total: Number(result._sum.totalAmount ?? 0),
      count: result._count._all,
    };
  }

  private async fetchTipPools(tenantId: string, start: Date, end: Date) {
    return this.prisma.tipPool.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: {
          in: [TipPoolStatus.DECLARED, TipPoolStatus.DISTRIBUTED, TipPoolStatus.FINALIZED],
        },
        // Filter by shift date — not declaredAt, which may fall outside the period window
        shift: { date: { gte: start, lt: end } },
      },
      select: { id: true, totalAmount: true },
    });
  }

  private async fetchLiveShift(tenantId: string) {
    return this.prisma.shift.findFirst({
      where: { tenantId, deletedAt: null, status: ShiftStatus.IN_PROGRESS },
      select: {
        id: true,
        shiftType: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        assignments: {
          where: { deletedAt: null },
          select: {
            employee: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
        },
        orders: {
          where: {
            deletedAt: null,
            status: { in: [OrderStatus.OPEN, OrderStatus.SENT, OrderStatus.PAID] },
          },
          select: { id: true, totalAmount: true, status: true },
          take: 500, // cap to avoid memory spikes on very busy shifts
        },
      },
    });
  }

  private async fetchTomorrowShifts(tenantId: string) {
    const now = new Date();
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    const dayAfterTomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2),
    );

    return this.prisma.shift.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [ShiftStatus.PLANNED, ShiftStatus.IN_PROGRESS] },
        // Range is more reliable than equality for @db.Date vs timestamptz comparisons
        date: { gte: tomorrow, lt: dayAfterTomorrow },
      },
      select: {
        id: true,
        shiftType: true,
        date: true,
        startTime: true,
        endTime: true,
        notes: true,
        assignments: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  private async fetchTopServers(tenantId: string, start: Date, end: Date) {
    // Aggregate PAID orders grouped by serverId
    const grouped = await this.prisma.order.groupBy({
      by: ['serverId'],
      where: {
        tenantId,
        deletedAt: null,
        status: OrderStatus.PAID,
        closedAt: { gte: start, lt: end },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });

    if (grouped.length === 0) return [];

    const serverIds = grouped.map((g) => g.serverId);

    // Fire all 3 sub-queries in parallel — avoids 3× round-trips
    const [employees, assignments, tipDists] = await Promise.all([
      // Employee names & roles
      this.prisma.employee.findMany({
        where: { id: { in: serverIds }, tenantId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, role: true },
      }),
      // Hours worked in the period via ShiftAssignment
      this.prisma.shiftAssignment.findMany({
        where: {
          tenantId,
          deletedAt: null,
          employeeId: { in: serverIds },
          shift: { date: { gte: start, lt: end }, deletedAt: null },
        },
        select: { employeeId: true, hoursWorked: true },
      }),
      // Fairness scores when available
      this.prisma.tipDistribution.findMany({
        where: {
          tenantId,
          deletedAt: null,
          employeeId: { in: serverIds },
          createdAt: { gte: start, lt: end },
        },
        select: { employeeId: true, contributionScore: true },
      }),
    ]);

    const hoursByEmployee = new Map<string, number>();
    for (const a of assignments) {
      hoursByEmployee.set(
        a.employeeId,
        (hoursByEmployee.get(a.employeeId) ?? 0) + Number(a.hoursWorked ?? 0),
      );
    }

    const scoreByEmployee = new Map<string, number>();
    for (const d of tipDists) {
      scoreByEmployee.set(
        d.employeeId,
        Math.max(
          scoreByEmployee.get(d.employeeId) ?? 0,
          Math.round(Number(d.contributionScore) * 100),
        ),
      );
    }

    return grouped.map((g) => {
      const emp = employees.find((e) => e.id === g.serverId);
      const hoursWorked = hoursByEmployee.get(g.serverId) ?? 0;
      const salesTotal = Number(g._sum.totalAmount ?? 0);
      return {
        id: g.serverId,
        firstName: emp?.firstName ?? 'Inconnu',
        lastName: emp?.lastName ?? '',
        role: emp?.role ?? EmployeeRole.SERVER,
        salesGenerated: parseFloat(salesTotal.toFixed(2)),
        tipsEstimated: parseFloat((salesTotal * 0.15).toFixed(2)),
        ordersCount: g._count._all,
        hoursWorked: parseFloat(hoursWorked.toFixed(2)),
        fairnessScore: scoreByEmployee.get(g.serverId) ?? null,
      };
    });
  }

  private async fetchRoleTips(tenantId: string, start: Date, end: Date) {
    // groupBy avoids loading every row into Node memory (OOM risk on large datasets)
    const grouped = await this.prisma.tipDistribution.groupBy({
      by: ['employeeId'],
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: start, lt: end },
        employee: { deletedAt: null },
      },
      _sum: { amount: true },
    });

    if (grouped.length === 0) return [];

    const empIds = grouped.map((g) => g.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: empIds }, tenantId, deletedAt: null },
      select: { id: true, role: true },
    });

    const roleMap = new Map(employees.map((e) => [e.id, e.role]));

    return grouped.map((g) => ({
      amount: g._sum.amount ?? 0,
      employee: { role: roleMap.get(g.employeeId) ?? EmployeeRole.SERVER },
    }));
  }

  private async computeFairnessScore(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<number | null> {
    const result = await this.prisma.tipDistribution.aggregate({
      where: { tenantId, deletedAt: null, createdAt: { gte: start, lt: end } },
      _avg: { contributionScore: true },
    });
    if (result._avg.contributionScore == null) return null;
    return Math.round(Number(result._avg.contributionScore) * 100);
  }

  private async fetchDailyTips(tenantId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const pools = await this.prisma.tipPool.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: {
          in: [TipPoolStatus.DECLARED, TipPoolStatus.DISTRIBUTED, TipPoolStatus.FINALIZED],
        },
        // Filter by shift date — not declaredAt, which may fall outside the 7-day window
        shift: { date: { gte: sevenDaysAgo } },
      },
      select: {
        totalAmount: true,
        shift: { select: { date: true } },
      },
    });

    const byDate = new Map<string, number>();
    for (const p of pools) {
      const d = p.shift?.date?.toISOString().slice(0, 10);
      if (!d) continue;
      byDate.set(d, (byDate.get(d) ?? 0) + Number(p.totalAmount));
    }

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      return { date: key, total: parseFloat((byDate.get(key) ?? 0).toFixed(2)) };
    });
  }

  private async countActiveEmployees(tenantId: string, start: Date, end: Date): Promise<number> {
    const result = await this.prisma.shiftAssignment.groupBy({
      by: ['employeeId'],
      where: {
        tenantId,
        deletedAt: null,
        shift: { date: { gte: start, lt: end }, deletedAt: null },
      },
    });
    return result.length;
  }

  private async fetchClosedShiftsWithoutPool(tenantId: string, start: Date, end: Date) {
    return this.prisma.shift.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: ShiftStatus.CLOSED,
        date: { gte: start, lt: end },
        tipPool: null,
      },
      select: { id: true, shiftType: true, date: true },
      take: 5,
    });
  }

  private async fetchIncompleteAssignments(tenantId: string, start: Date, end: Date) {
    return this.prisma.shiftAssignment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        hoursWorked: null,
        shift: {
          date: { gte: start, lt: end },
          status: ShiftStatus.CLOSED,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        employeeId: true,
        employee: { select: { firstName: true, lastName: true } },
        shift: { select: { id: true, shiftType: true, date: true } },
      },
      take: 5,
    });
  }

  // ── Shape helpers ─────────────────────────────────────────────────────────

  private aggregateHourlySales(orders: { closedAt: Date | null; totalAmount: unknown }[]) {
    const buckets = new Map<string, number>();
    for (const o of orders) {
      if (!o.closedAt) continue;
      const bucket = `${String(o.closedAt.getUTCHours()).padStart(2, '0')}:00`;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + Number(o.totalAmount));
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, total]) => ({ hour, total: parseFloat(total.toFixed(2)) }));
  }

  private buildRoleBreakdown(
    distributions: { amount: unknown; employee: { role: EmployeeRole } }[],
  ) {
    const byRole = new Map<EmployeeRole, number>();
    let grandTotal = 0;
    for (const d of distributions) {
      const amt = Number(d.amount);
      byRole.set(d.employee.role, (byRole.get(d.employee.role) ?? 0) + amt);
      grandTotal += amt;
    }
    if (grandTotal === 0) return [];

    return Array.from(byRole.entries()).map(([role, total]) => ({
      role: String(role),
      label: this.roleLabel(role),
      color: ROLE_COLOR[role] ?? '#6366F1',
      total: parseFloat(total.toFixed(2)),
      share: parseFloat((total / grandTotal).toFixed(4)),
    }));
  }

  private buildAlerts(
    closedShiftsWithoutPool: { id: string; shiftType: string; date: Date }[],
    incompleteAssignments: {
      id: string;
      employeeId: string;
      employee: { firstName: string; lastName: string };
      shift: { id: string; shiftType: string; date: Date };
    }[],
  ) {
    const alerts: {
      type: 'NO_TIP_POOL' | 'NO_HOURS';
      message: string;
      shiftId?: string;
      employeeId?: string;
      severity: 'warn' | 'error';
    }[] = [];

    for (const s of closedShiftsWithoutPool) {
      alerts.push({
        type: 'NO_TIP_POOL',
        message: `Shift ${s.shiftType} du ${s.date.toISOString().slice(0, 10)} clôturé sans pool déclaré.`,
        shiftId: s.id,
        severity: 'warn',
      });
    }

    for (const a of incompleteAssignments) {
      alerts.push({
        type: 'NO_HOURS',
        message: `${a.employee.firstName} ${a.employee.lastName} — heures non saisies.`,
        shiftId: a.shift.id,
        employeeId: a.employeeId,
        severity: 'warn',
      });
    }

    return alerts;
  }

  private formatLiveShift(shift: NonNullable<Awaited<ReturnType<typeof this.fetchLiveShift>>>) {
    // Progress calculation using Date objects
    const startFrac = toHourFrac(shift.startTime);
    let endFrac = toHourFrac(shift.endTime);
    if (endFrac <= startFrac) endFrac += 24; // overnight shift

    const now = new Date();
    const nowFrac = now.getUTCHours() + now.getUTCMinutes() / 60;
    const progressPct = Math.min(
      100,
      Math.max(0, ((nowFrac - startFrac) / (endFrac - startFrac)) * 100),
    );

    const liveOrdersTotal = shift.orders.reduce((s, o) => s + Number(o.totalAmount), 0);

    return {
      id: shift.id,
      type: shift.shiftType,
      date: shift.date.toISOString().slice(0, 10),
      startTime: toHHMM(shift.startTime),
      endTime: toHHMM(shift.endTime),
      status: shift.status,
      liveOrdersCount: shift.orders.length,
      liveOrdersTotal: parseFloat(liveOrdersTotal.toFixed(2)),
      tipsEstimated: parseFloat((liveOrdersTotal * 0.15).toFixed(2)),
      teamCount: shift.assignments.length,
      team: shift.assignments.map((a) => a.employee).filter(Boolean),
      progressPct: parseFloat(progressPct.toFixed(1)),
    };
  }

  private formatTomorrowShift(shift: {
    id: string;
    shiftType: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    notes: string | null;
    assignments: { id: string }[];
  }) {
    return {
      id: shift.id,
      type: shift.shiftType,
      date: shift.date.toISOString().slice(0, 10),
      startTime: toHHMM(shift.startTime),
      endTime: toHHMM(shift.endTime),
      notes: shift.notes,
      staffCount: shift.assignments.length,
      isUnderstaffed: shift.assignments.length < 4,
    };
  }

  private roleLabel(role: EmployeeRole): string {
    const labels: Record<EmployeeRole, string> = {
      [EmployeeRole.SERVER]: 'Serveurs',
      [EmployeeRole.BARTENDER]: 'Bar',
      [EmployeeRole.BUSSER]: 'Aide de salle',
      [EmployeeRole.COOK]: 'Cuisine',
      [EmployeeRole.CHEF]: 'Chef',
      [EmployeeRole.HOST]: 'Accueil',
    };
    return labels[role] ?? role;
  }
}
