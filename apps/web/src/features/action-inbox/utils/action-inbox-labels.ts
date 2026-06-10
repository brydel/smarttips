import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import type {
  ActionItem,
  ActionItemSeverity,
  ActionItemStatus,
  ActionItemType,
} from '../types/action-inbox.types';

export const TYPE_LABELS: Record<ActionItemType, string> = {
  DISTRIBUTION_MISSING: 'Distribution manquante',
  DISTRIBUTION_PENDING_APPROVAL: 'Distribution à finaliser',
  SHIFT_CLOSE_OVERDUE: 'Clôture en retard',
  SHIFT_UNASSIGNED: 'Personnel manquant',
  DISPUTE_OPEN: "Question d'employé",
};

export const STATUS_LABELS: Record<ActionItemStatus, string> = {
  OPEN: 'À traiter',
  RESOLVED: 'Résolue',
  DISMISSED: 'Ignorée',
};

export interface SeverityConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const SEVERITY_CONFIG: Record<ActionItemSeverity, SeverityConfig> = {
  CRITICAL: {
    label: 'Critique',
    color: 'var(--st-danger)',
    bg: 'rgba(239,68,68,.1)',
    border: 'rgba(239,68,68,.3)',
  },
  WARNING: {
    label: 'Attention',
    color: 'var(--st-gold)',
    bg: 'rgba(212,165,116,.14)',
    border: 'rgba(212,165,116,.3)',
  },
  INFO: {
    label: 'Info',
    color: 'var(--st-indigo-glow)',
    bg: 'rgba(99,102,241,.12)',
    border: 'rgba(99,102,241,.3)',
  },
};

const SHIFT_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
  LATE_NIGHT: 'Nuit',
};

const TIP_POOL_STATUS_LABELS: Record<string, string> = {
  DECLARED: 'Déclaré',
  DISTRIBUTED: 'Distribué',
  FINALIZED: 'Finalisé',
  VOIDED: 'Annulé',
};

/** Lien profond vers l'écran où l'action se traite. */
export function actionItemHref(item: ActionItem): string | null {
  if (item.type === 'DISPUTE_OPEN') {
    return '/dashboard/disputes';
  }
  if (!item.shiftId) return null;
  if (item.type === 'DISTRIBUTION_MISSING' || item.type === 'DISTRIBUTION_PENDING_APPROVAL') {
    return `/dashboard/shifts/${item.shiftId}/distribution`;
  }
  return `/dashboard/shifts/${item.shiftId}`;
}

/** Libellé du lien de traitement, selon la destination. */
export function actionItemLinkLabel(item: ActionItem): string {
  if (item.type === 'DISPUTE_OPEN') {
    return 'Ouvrir la file des litiges';
  }
  return 'Ouvrir le shift concerné';
}

export interface EvidenceEntry {
  label: string;
  value: string;
}

function fmtDateTime(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr });
}

/**
 * Rend les évidences du payload avec des libellés FR.
 * Seules les clés connues (ids, dates, compteurs) sont affichées.
 */
const DISPUTE_CATEGORY_LABELS: Record<string, string> = {
  AMOUNT: 'Montant',
  HOURS: 'Heures',
  ROLE: 'Rôle',
  OTHER: 'Autre',
};

export function formatEvidence(payload: Record<string, unknown> | null): EvidenceEntry[] {
  if (!payload) return [];

  const entries: EvidenceEntry[] = [];

  if (typeof payload.category === 'string') {
    entries.push({
      label: 'Catégorie',
      value: DISPUTE_CATEGORY_LABELS[payload.category] ?? payload.category,
    });
  }
  if (typeof payload.openedAt === 'string') {
    entries.push({ label: 'Ouverte le', value: fmtDateTime(payload.openedAt) });
  }
  if (typeof payload.shiftDate === 'string') {
    entries.push({ label: 'Date du shift', value: payload.shiftDate });
  }
  if (typeof payload.shiftType === 'string') {
    entries.push({
      label: 'Service',
      value: SHIFT_TYPE_LABELS[payload.shiftType] ?? payload.shiftType,
    });
  }
  if (typeof payload.hasTipPool === 'boolean') {
    entries.push({ label: 'Pool déclaré', value: payload.hasTipPool ? 'Oui' : 'Non' });
  }
  if ('tipPoolStatus' in payload) {
    const status = payload.tipPoolStatus;
    entries.push({
      label: 'Statut du pool',
      value: typeof status === 'string' ? (TIP_POOL_STATUS_LABELS[status] ?? status) : '—',
    });
  }
  if (typeof payload.distributionCount === 'number') {
    entries.push({ label: 'Parts calculées', value: String(payload.distributionCount) });
  }
  if (typeof payload.startTime === 'string') {
    entries.push({ label: 'Début prévu', value: fmtDateTime(payload.startTime) });
  }
  if (typeof payload.endTime === 'string') {
    entries.push({ label: 'Fin prévue', value: fmtDateTime(payload.endTime) });
  }
  if (typeof payload.overdueMinutes === 'number') {
    entries.push({ label: 'Retard', value: `${payload.overdueMinutes} min` });
  }

  return entries;
}
