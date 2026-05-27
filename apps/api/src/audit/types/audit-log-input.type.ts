import { AuditAction, Prisma } from '@prisma/client';

export type AuditJsonValue = Prisma.InputJsonObject | Prisma.InputJsonArray | Prisma.InputJsonValue;

export type AuditLogInput = {
  tenantId: string;

  /**
   * User qui a déclenché l'action.
   * Peut être absent pour certains événements système ou publics.
   * Exemple : acceptation d'invitation avant authentification complète.
   */
  userId?: string | null;

  action: AuditAction;

  /**
   * Nom logique de l'entité concernée.
   * Exemples :
   * - EmployeeInvitation
   * - Employee
   * - TipDistribution
   * - Shift
   * - DistributionConfig
   */
  entityType: string;

  /**
   * UUID de l'entité concernée.
   * Optionnel pour certains événements système.
   */
  entityId: string;

  /**
   * Snapshot avant modification.
   * Ne jamais inclure de secrets : password, hashedPassword, tokenHash, JWT, API keys.
   */
  oldValues?: AuditJsonValue | null;

  /**
   * Snapshot après modification.
   * Ne jamais inclure de secrets : password, hashedPassword, tokenHash, JWT, API keys.
   */
  newValues?: AuditJsonValue | null;

  /**
   * Contexte additionnel non essentiel au diff.
   * Exemple : source, module, reason, emailSent.
   */
  metadata?: AuditJsonValue | null;

  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};
