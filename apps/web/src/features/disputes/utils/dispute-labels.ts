import type {
  TipDisputeCategory,
  TipDisputeOutcome,
  TipDisputeStatus,
} from '../types/dispute.types';

export const DISPUTE_CATEGORY_LABELS: Record<TipDisputeCategory, string> = {
  AMOUNT: 'Montant',
  HOURS: 'Heures',
  ROLE: 'Rôle',
  OTHER: 'Autre',
};

export const DISPUTE_STATUS_LABELS: Record<TipDisputeStatus, string> = {
  OPEN: 'En attente',
  IN_REVIEW: 'En cours de traitement',
  RESOLVED: 'Résolue',
  WITHDRAWN: 'Retirée',
};

/**
 * Libellés d'issue volontairement honnêtes : un litige ne modifie JAMAIS
 * un montant. On ne dit jamais « corrigé », « ajusté » ou « appliqué » —
 * MANUAL_FOLLOW_UP signifie qu'une action humaine hors système est requise.
 */
export const DISPUTE_OUTCOME_LABELS: Record<TipDisputeOutcome, string> = {
  EXPLAINED: 'Explication fournie — aucun changement',
  MANUAL_FOLLOW_UP: 'Suivi manuel par votre gestionnaire',
};

/** Variante côté manager pour le choix d'issue, même honnêteté. */
export const DISPUTE_OUTCOME_DESCRIPTIONS: Record<TipDisputeOutcome, string> = {
  EXPLAINED: 'Le calcul est correct : vous fournissez une explication, rien ne change.',
  MANUAL_FOLLOW_UP:
    'Une action manuelle est nécessaire hors système. Aucun montant n’est modifié ici.',
};

export interface DisputeStatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const DISPUTE_STATUS_CONFIG: Record<TipDisputeStatus, DisputeStatusConfig> = {
  OPEN: {
    label: DISPUTE_STATUS_LABELS.OPEN,
    color: 'var(--st-gold)',
    bg: 'rgba(212,165,116,.14)',
    border: 'rgba(212,165,116,.3)',
  },
  IN_REVIEW: {
    label: DISPUTE_STATUS_LABELS.IN_REVIEW,
    color: 'var(--st-indigo-glow)',
    bg: 'rgba(99,102,241,.12)',
    border: 'rgba(99,102,241,.3)',
  },
  RESOLVED: {
    label: DISPUTE_STATUS_LABELS.RESOLVED,
    color: 'var(--st-emerald-glow)',
    bg: 'rgba(16,185,129,.12)',
    border: 'rgba(16,185,129,.3)',
  },
  WITHDRAWN: {
    label: DISPUTE_STATUS_LABELS.WITHDRAWN,
    color: 'var(--st-dim)',
    bg: 'rgba(148,163,184,.1)',
    border: 'rgba(148,163,184,.25)',
  },
};

/** Litige actif = bloque l'ouverture d'un nouveau litige sur la distribution. */
export function isActiveDisputeStatus(status: TipDisputeStatus): boolean {
  return status === 'OPEN' || status === 'IN_REVIEW';
}
