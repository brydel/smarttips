import { Injectable } from '@nestjs/common';
import {
  ActionItemSeverity,
  ActionItemStatus,
  ActionItemType,
  AuditAction,
  Prisma,
  ShiftStatus,
  ShiftType,
  TipPoolStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RefreshActionInboxResult } from './types/action-item-view.type';

/** Fenêtre de détection des shifts clôturés sans distribution. */
const LOOKBACK_DAYS = 30;
/** Délai de grâce avant de signaler un service non clôturé. */
const CLOSE_OVERDUE_GRACE_MINUTES = 60;
/** Horizon des shifts à venir sans personnel assigné. */
const UPCOMING_WINDOW_HOURS = 48;

/** Libellés FR alignés sur SHIFT_TYPE_LABELS côté web. */
const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  [ShiftType.BREAKFAST]: 'Petit-déjeuner',
  [ShiftType.LUNCH]: 'Déjeuner',
  [ShiftType.DINNER]: 'Dîner',
  [ShiftType.LATE_NIGHT]: 'Nuit',
};

type DetectedItem = {
  type: ActionItemType;
  severity: ActionItemSeverity;
  title: string;
  entityType: string;
  entityId: string;
  shiftId: string | null;
  payload: Prisma.InputJsonObject;
  dedupeKey: string;
};

function shiftLabel(date: Date, shiftType: ShiftType): string {
  return `${SHIFT_TYPE_LABELS[shiftType]} du ${date.toISOString().slice(0, 10)}`;
}

function dedupeKey(type: ActionItemType, entityId: string): string {
  return `${type}:${entityId}`;
}

/**
 * Détecteurs à base de règles de la Boîte d'actions manager (BIS-54).
 *
 * Chaque exécution est idempotente grâce à dedupeKey (unique par tenant) :
 * - condition détectée + aucun item → création (audit ACTION_ITEM_CREATED) ;
 * - condition détectée + item OPEN → rafraîchissement silencieux de l'évidence ;
 * - condition détectée + item RESOLVED/DISMISSED → jamais réouvert en V1 ;
 * - condition disparue + item OPEN issu d'un détecteur → auto-résolution
 *   (audit ACTION_ITEM_RESOLVED, metadata.reason = "auto").
 */
@Injectable()
export class ActionInboxDetectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async refresh(tenantId: string, userId: string): Promise<RefreshActionInboxResult> {
    const now = new Date();

    const detected = (
      await Promise.all([
        this.detectDistributionMissing(tenantId, now),
        this.detectDistributionPendingApproval(tenantId),
        this.detectShiftCloseOverdue(tenantId, now),
        this.detectShiftUnassigned(tenantId, now),
      ])
    ).flat();

    const existing = await this.prisma.actionItem.findMany({
      where: { tenantId },
      select: { id: true, dedupeKey: true, status: true, type: true },
    });

    const existingByKey = new Map(existing.map((item) => [item.dedupeKey, item]));
    const detectedKeys = new Set(detected.map((item) => item.dedupeKey));

    let created = 0;

    for (const item of detected) {
      const current = existingByKey.get(item.dedupeKey);

      if (!current) {
        const row = await this.prisma.actionItem.create({
          data: { tenantId, ...item },
          select: { id: true },
        });

        await this.audit.log({
          tenantId,
          userId,
          action: AuditAction.ACTION_ITEM_CREATED,
          entityType: 'ActionItem',
          entityId: row.id,
          newValues: {
            type: item.type,
            severity: item.severity,
            status: ActionItemStatus.OPEN,
            dedupeKey: item.dedupeKey,
          },
          metadata: { source: 'detector' },
        });

        created += 1;
        continue;
      }

      if (current.status === ActionItemStatus.OPEN) {
        // Évidence rafraîchie sans changement d'état : pas d'événement d'audit.
        await this.prisma.actionItem.update({
          where: { id: current.id },
          data: {
            severity: item.severity,
            title: item.title,
            payload: item.payload,
          },
        });
      }
      // RESOLVED / DISMISSED : jamais réouvert en V1.
    }

    let autoResolved = 0;
    const stale = existing.filter(
      (item) => item.status === ActionItemStatus.OPEN && !detectedKeys.has(item.dedupeKey),
    );

    for (const item of stale) {
      await this.prisma.actionItem.update({
        where: { id: item.id },
        data: {
          status: ActionItemStatus.RESOLVED,
          resolvedAt: now,
          resolvedById: null,
        },
      });

      await this.audit.log({
        tenantId,
        userId,
        action: AuditAction.ACTION_ITEM_RESOLVED,
        entityType: 'ActionItem',
        entityId: item.id,
        oldValues: { status: ActionItemStatus.OPEN },
        newValues: { status: ActionItemStatus.RESOLVED },
        metadata: { reason: 'auto' },
      });

      autoResolved += 1;
    }

    const open = await this.prisma.actionItem.count({
      where: { tenantId, status: ActionItemStatus.OPEN },
    });

    return { created, autoResolved, open };
  }

  /** Shift CLOSED sans distribution lancée (pool absent ou encore DECLARED). */
  private async detectDistributionMissing(tenantId: string, now: Date): Promise<DetectedItem[]> {
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const shifts = await this.prisma.shift.findMany({
      where: {
        tenantId,
        status: ShiftStatus.CLOSED,
        deletedAt: null,
        date: { gte: since },
        OR: [
          { tipPool: { is: null } },
          { tipPool: { is: { status: TipPoolStatus.DECLARED, deletedAt: null } } },
        ],
      },
      select: {
        id: true,
        date: true,
        shiftType: true,
        tipPool: { select: { status: true } },
      },
    });

    return shifts.map((shift) => ({
      type: ActionItemType.DISTRIBUTION_MISSING,
      severity: ActionItemSeverity.CRITICAL,
      title: `Distribution à lancer · ${shiftLabel(shift.date, shift.shiftType)}`,
      entityType: 'Shift',
      entityId: shift.id,
      shiftId: shift.id,
      payload: {
        shiftDate: shift.date.toISOString().slice(0, 10),
        shiftType: shift.shiftType,
        hasTipPool: shift.tipPool !== null,
        tipPoolStatus: shift.tipPool?.status ?? null,
      },
      dedupeKey: dedupeKey(ActionItemType.DISTRIBUTION_MISSING, shift.id),
    }));
  }

  /** Pool calculé (DISTRIBUTED) en attente de finalisation. */
  private async detectDistributionPendingApproval(tenantId: string): Promise<DetectedItem[]> {
    const pools = await this.prisma.tipPool.findMany({
      where: {
        tenantId,
        status: TipPoolStatus.DISTRIBUTED,
        deletedAt: null,
        shift: { deletedAt: null },
      },
      select: {
        id: true,
        shiftId: true,
        shift: { select: { date: true, shiftType: true } },
        _count: { select: { distributions: { where: { deletedAt: null } } } },
      },
    });

    return pools.map((pool) => ({
      type: ActionItemType.DISTRIBUTION_PENDING_APPROVAL,
      severity: ActionItemSeverity.WARNING,
      title: `Distribution à finaliser · ${shiftLabel(pool.shift.date, pool.shift.shiftType)}`,
      entityType: 'TipPool',
      entityId: pool.id,
      shiftId: pool.shiftId,
      payload: {
        shiftDate: pool.shift.date.toISOString().slice(0, 10),
        shiftType: pool.shift.shiftType,
        distributionCount: pool._count.distributions,
      },
      dedupeKey: dedupeKey(ActionItemType.DISTRIBUTION_PENDING_APPROVAL, pool.id),
    }));
  }

  /** Service IN_PROGRESS dont la fin prévue est dépassée au-delà du délai de grâce. */
  private async detectShiftCloseOverdue(tenantId: string, now: Date): Promise<DetectedItem[]> {
    const threshold = new Date(now.getTime() - CLOSE_OVERDUE_GRACE_MINUTES * 60 * 1000);

    const shifts = await this.prisma.shift.findMany({
      where: {
        tenantId,
        status: ShiftStatus.IN_PROGRESS,
        deletedAt: null,
        endTime: { lt: threshold },
      },
      select: { id: true, date: true, shiftType: true, endTime: true },
    });

    return shifts.map((shift) => ({
      type: ActionItemType.SHIFT_CLOSE_OVERDUE,
      severity: ActionItemSeverity.WARNING,
      title: `Service à clôturer · ${shiftLabel(shift.date, shift.shiftType)}`,
      entityType: 'Shift',
      entityId: shift.id,
      shiftId: shift.id,
      payload: {
        shiftDate: shift.date.toISOString().slice(0, 10),
        shiftType: shift.shiftType,
        endTime: shift.endTime.toISOString(),
        overdueMinutes: Math.floor((now.getTime() - shift.endTime.getTime()) / 60_000),
      },
      dedupeKey: dedupeKey(ActionItemType.SHIFT_CLOSE_OVERDUE, shift.id),
    }));
  }

  /** Shift PLANNED dans les prochaines 48 h sans aucune assignation active. */
  private async detectShiftUnassigned(tenantId: string, now: Date): Promise<DetectedItem[]> {
    const horizon = new Date(now.getTime() + UPCOMING_WINDOW_HOURS * 60 * 60 * 1000);

    const shifts = await this.prisma.shift.findMany({
      where: {
        tenantId,
        status: ShiftStatus.PLANNED,
        deletedAt: null,
        startTime: { gte: now, lte: horizon },
        assignments: { none: { deletedAt: null } },
      },
      select: { id: true, date: true, shiftType: true, startTime: true },
    });

    return shifts.map((shift) => ({
      type: ActionItemType.SHIFT_UNASSIGNED,
      severity: ActionItemSeverity.WARNING,
      title: `Personnel à assigner · ${shiftLabel(shift.date, shift.shiftType)}`,
      entityType: 'Shift',
      entityId: shift.id,
      shiftId: shift.id,
      payload: {
        shiftDate: shift.date.toISOString().slice(0, 10),
        shiftType: shift.shiftType,
        startTime: shift.startTime.toISOString(),
      },
      dedupeKey: dedupeKey(ActionItemType.SHIFT_UNASSIGNED, shift.id),
    }));
  }
}
