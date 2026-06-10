import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, TipDisputeStatus, TipPoolStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { redactExplanation } from '../employees/explanation-redaction';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ListDisputesDto } from './dto/list-disputes.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import {
  DisputeEvidenceSnapshot,
  EmployeeDisputeView,
  employeeDisputeViewSelect,
  ListDisputesResult,
  ManagerDisputeView,
  managerDisputeViewSelect,
} from './types/dispute-view.type';

const DEFAULT_LIMIT = 50;

/** Statuts considérés actifs : un seul litige actif par distribution (V1, service-enforced). */
const ACTIVE_STATUSES = [TipDisputeStatus.OPEN, TipDisputeStatus.IN_REVIEW] as const;

/**
 * Litiges structurés de pourboires (BIS-56).
 *
 * Invariants :
 * - Un litige ne modifie JAMAIS un payout ni une distribution.
 * - L'identité employé vient exclusivement du JWT (tenantId + userId) ;
 *   jamais d'employeeId accepté en entrée sur les routes employé.
 * - Accès cross-tenant et cross-employé → 404 (jamais 403, pas d'oracle).
 * - evidenceSnapshot est immuable, capturé à la création, redacté par la
 *   liste blanche BIS-55, sans aucune donnée de collègue.
 * - Cycle de vie : OPEN → IN_REVIEW → RESOLVED ; OPEN → RESOLVED ;
 *   OPEN → WITHDRAWN. Pas de retrait depuis IN_REVIEW, pas de réouverture.
 */
@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Employé ─────────────────────────────────────────────────────────────────

  /**
   * POST /employee/me/disputes
   * Ouvre un litige sur UNE distribution appartenant à l'employé authentifié.
   * 409 si un litige actif (OPEN/IN_REVIEW) existe déjà sur la distribution.
   * Limitation V1 documentée : la garde anti-doublon est applicative
   * (findFirst + create non transactionnels au sens d'un index unique partiel),
   * une course simultanée peut en théorie créer deux litiges actifs.
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateDisputeDto,
  ): Promise<EmployeeDisputeView> {
    const employee = await this.resolveEmployee(tenantId, userId);

    // Distribution éligible : la sienne, sur pool calculé ou finalisé.
    const distribution = await this.prisma.tipDistribution.findFirst({
      where: {
        id: dto.tipDistributionId,
        tenantId,
        employeeId: employee.id,
        deletedAt: null,
        tipPool: {
          deletedAt: null,
          status: { in: [TipPoolStatus.DISTRIBUTED, TipPoolStatus.FINALIZED] },
          shift: { deletedAt: null },
        },
      },
      select: {
        id: true,
        amount: true,
        contributionScore: true,
        computationMethod: true,
        explanation: true,
        tipPool: {
          select: {
            status: true,
            shift: { select: { id: true, date: true, shiftType: true } },
          },
        },
      },
    });

    if (!distribution) {
      throw new NotFoundException('error.dispute.distributionNotFound');
    }

    const active = await this.prisma.tipDispute.findFirst({
      where: {
        tenantId,
        tipDistributionId: distribution.id,
        status: { in: [...ACTIVE_STATUSES] },
      },
      select: { id: true },
    });

    if (active) {
      throw new ConflictException('error.dispute.alreadyActive');
    }

    const snapshot = await this.buildEvidenceSnapshot(tenantId, employee.id, distribution);

    const dispute = await this.prisma.tipDispute.create({
      data: {
        tenantId,
        employeeId: employee.id,
        tipDistributionId: distribution.id,
        category: dto.category,
        message: dto.message,
        status: TipDisputeStatus.OPEN,
        evidenceSnapshot: snapshot as unknown as Prisma.InputJsonObject,
      },
      select: employeeDisputeViewSelect,
    });

    // Audit : métadonnées de transition sûres uniquement — jamais le message.
    await this.audit.log({
      tenantId,
      userId,
      action: AuditAction.DISPUTE_OPENED,
      entityType: 'TipDispute',
      entityId: dispute.id,
      newValues: {
        status: TipDisputeStatus.OPEN,
        category: dto.category,
        tipDistributionId: distribution.id,
      },
      metadata: { source: 'employee' },
    });

    return dispute;
  }

  /**
   * GET /employee/me/disputes
   * Litiges de l'employé authentifié uniquement, du plus récent au plus ancien.
   */
  async listMine(tenantId: string, userId: string): Promise<EmployeeDisputeView[]> {
    const employee = await this.resolveEmployee(tenantId, userId);

    return this.prisma.tipDispute.findMany({
      where: { tenantId, employeeId: employee.id },
      select: employeeDisputeViewSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * PATCH /employee/me/disputes/:id/withdraw
   * Retrait par l'employé : possible uniquement tant que le litige est OPEN.
   * Dès IN_REVIEW, le retrait est bloqué (pas de réouverture en V1).
   */
  async withdraw(tenantId: string, userId: string, id: string): Promise<EmployeeDisputeView> {
    const employee = await this.resolveEmployee(tenantId, userId);

    const dispute = await this.prisma.tipDispute.findFirst({
      where: { id, tenantId, employeeId: employee.id },
      select: { id: true, status: true },
    });

    if (!dispute) {
      throw new NotFoundException('error.dispute.notFound');
    }

    if (dispute.status !== TipDisputeStatus.OPEN) {
      throw new BadRequestException('error.dispute.invalidTransition');
    }

    // Garde concurrente : n'aboutit que si le litige est toujours OPEN.
    const result = await this.prisma.tipDispute.updateMany({
      where: { id, tenantId, employeeId: employee.id, status: TipDisputeStatus.OPEN },
      data: { status: TipDisputeStatus.WITHDRAWN, withdrawnAt: new Date() },
    });

    if (result.count === 0) {
      throw new BadRequestException('error.dispute.invalidTransition');
    }

    await this.audit.log({
      tenantId,
      userId,
      action: AuditAction.DISPUTE_WITHDRAWN,
      entityType: 'TipDispute',
      entityId: id,
      oldValues: { status: TipDisputeStatus.OPEN },
      newValues: { status: TipDisputeStatus.WITHDRAWN },
      metadata: { source: 'employee' },
    });

    return this.getEmployeeView(tenantId, employee.id, id);
  }

  // ── Manager ─────────────────────────────────────────────────────────────────

  /**
   * GET /disputes
   * File des litiges du tenant, filtrable par statut et catégorie.
   */
  async list(tenantId: string, dto: ListDisputesDto): Promise<ListDisputesResult> {
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const offset = dto.offset ?? 0;

    const where: Prisma.TipDisputeWhereInput = {
      tenantId,
      ...(dto.status?.length ? { status: { in: dto.status } } : {}),
      ...(dto.category?.length ? { category: { in: dto.category } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tipDispute.findMany({
        where,
        select: managerDisputeViewSelect,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.tipDispute.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  /**
   * GET /disputes/:id
   * 404 si le litige n'existe pas ou appartient à un autre tenant.
   */
  async getById(tenantId: string, id: string): Promise<ManagerDisputeView> {
    const dispute = await this.prisma.tipDispute.findFirst({
      where: { id, tenantId },
      select: managerDisputeViewSelect,
    });

    if (!dispute) {
      throw new NotFoundException('error.dispute.notFound');
    }

    return dispute;
  }

  /**
   * PATCH /disputes/:id/review — « Prendre en charge ».
   * Transition OPEN → IN_REVIEW uniquement.
   */
  async startReview(tenantId: string, userId: string, id: string): Promise<ManagerDisputeView> {
    const dispute = await this.prisma.tipDispute.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });

    if (!dispute) {
      throw new NotFoundException('error.dispute.notFound');
    }

    if (dispute.status !== TipDisputeStatus.OPEN) {
      throw new BadRequestException('error.dispute.invalidTransition');
    }

    const result = await this.prisma.tipDispute.updateMany({
      where: { id, tenantId, status: TipDisputeStatus.OPEN },
      data: {
        status: TipDisputeStatus.IN_REVIEW,
        reviewStartedAt: new Date(),
        reviewedById: userId,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('error.dispute.invalidTransition');
    }

    await this.audit.log({
      tenantId,
      userId,
      action: AuditAction.DISPUTE_REVIEW_STARTED,
      entityType: 'TipDispute',
      entityId: id,
      oldValues: { status: TipDisputeStatus.OPEN },
      newValues: { status: TipDisputeStatus.IN_REVIEW },
      metadata: { source: 'manager' },
    });

    return this.getById(tenantId, id);
  }

  /**
   * PATCH /disputes/:id/resolve
   * Transition OPEN|IN_REVIEW → RESOLVED, note obligatoire.
   * Aucune issue ne modifie un montant : EXPLAINED documente l'explication,
   * MANUAL_FOLLOW_UP documente un suivi manuel hors système.
   */
  async resolve(
    tenantId: string,
    userId: string,
    id: string,
    dto: ResolveDisputeDto,
  ): Promise<ManagerDisputeView> {
    const dispute = await this.prisma.tipDispute.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });

    if (!dispute) {
      throw new NotFoundException('error.dispute.notFound');
    }

    if (dispute.status !== TipDisputeStatus.OPEN && dispute.status !== TipDisputeStatus.IN_REVIEW) {
      throw new BadRequestException('error.dispute.invalidTransition');
    }

    const result = await this.prisma.tipDispute.updateMany({
      where: {
        id,
        tenantId,
        status: { in: [TipDisputeStatus.OPEN, TipDisputeStatus.IN_REVIEW] },
      },
      data: {
        status: TipDisputeStatus.RESOLVED,
        outcome: dto.outcome,
        resolutionNote: dto.resolutionNote,
        resolvedAt: new Date(),
        resolvedById: userId,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('error.dispute.invalidTransition');
    }

    // Audit : transition + issue uniquement — jamais le texte de la note.
    await this.audit.log({
      tenantId,
      userId,
      action: AuditAction.DISPUTE_RESOLVED,
      entityType: 'TipDispute',
      entityId: id,
      oldValues: { status: dispute.status },
      newValues: { status: TipDisputeStatus.RESOLVED, outcome: dto.outcome },
      metadata: { source: 'manager' },
    });

    return this.getById(tenantId, id);
  }

  // ── Internes ────────────────────────────────────────────────────────────────

  /**
   * Lie l'utilisateur authentifié à SON dossier employé.
   * L'employeeId ne vient jamais de la requête.
   */
  private async resolveEmployee(tenantId: string, userId: string): Promise<{ id: string }> {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException('error.employee.notLinked');
    }

    return employee;
  }

  private async getEmployeeView(
    tenantId: string,
    employeeId: string,
    id: string,
  ): Promise<EmployeeDisputeView> {
    const dispute = await this.prisma.tipDispute.findFirst({
      where: { id, tenantId, employeeId },
      select: employeeDisputeViewSelect,
    });

    if (!dispute) {
      throw new NotFoundException('error.dispute.notFound');
    }

    return dispute;
  }

  /**
   * Snapshot immuable au moment de l'ouverture : données de l'employé
   * concerné uniquement, explication passée par la liste blanche BIS-55.
   * Jamais de spread du JSON brut, jamais de données de collègues.
   */
  private async buildEvidenceSnapshot(
    tenantId: string,
    employeeId: string,
    distribution: {
      id: string;
      amount: Prisma.Decimal;
      contributionScore: Prisma.Decimal;
      computationMethod: DisputeEvidenceSnapshot['computationMethod'];
      explanation: Prisma.JsonValue;
      tipPool: {
        status: DisputeEvidenceSnapshot['poolStatus'];
        shift: { id: string; date: Date; shiftType: DisputeEvidenceSnapshot['shiftType'] };
      };
    },
  ): Promise<DisputeEvidenceSnapshot> {
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: {
        tenantId,
        employeeId,
        shiftId: distribution.tipPool.shift.id,
        deletedAt: null,
      },
      select: { roleDuringShift: true, hoursWorked: true },
    });

    return {
      snapshotVersion: 1,
      capturedAt: new Date().toISOString(),
      tipDistributionId: distribution.id,
      shiftId: distribution.tipPool.shift.id,
      shiftDate: distribution.tipPool.shift.date.toISOString().slice(0, 10),
      shiftType: distribution.tipPool.shift.shiftType,
      amount: distribution.amount.toFixed(2),
      contributionScore: distribution.contributionScore.toString(),
      computationMethod: distribution.computationMethod,
      poolStatus: distribution.tipPool.status,
      roleDuringShift: assignment?.roleDuringShift ?? null,
      hoursWorked: assignment?.hoursWorked?.toFixed(2) ?? null,
      explanation: redactExplanation(distribution.explanation),
    };
  }
}
