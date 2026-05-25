/**
 * Formatting utilities for the distribution feature.
 * All monetary conversions use parseFloat (string → number) only for display.
 */

/** Format a number as USD with 2 decimal places. */
export function fmtMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Format a number as compact USD (no decimals for large values). */
export function fmtMoneyCompact(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

/** Format a percentage with 1 decimal. */
export function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Format hours with 1 decimal. */
export function fmtHours(value: number): string {
  return `${value.toFixed(1)}h`;
}

/** Format a score with 2 decimals. */
export function fmtScore(value: number): string {
  return value.toFixed(2);
}

/** Format coefficient with 2 decimals. */
export function fmtCoef(value: number): string {
  return value.toFixed(2);
}

/** Format a multiplier (salesBonus) as ×N.NN */
export function fmtMultiplier(value: number): string {
  return `×${value.toFixed(2)}`;
}

/** Format sales bonus extra percentage: e.g. +18% */
export function fmtSalesBonusPct(salesBonusMultiplier: number): string {
  const pct = (salesBonusMultiplier - 1) * 100;
  return `+${pct.toFixed(0)}%`;
}

/** Format rounding adjustment in cents for display. */
export function fmtRoundingCents(cents: number): string {
  if (cents === 0) return '0 ¢';
  const sign = cents > 0 ? '+' : '';
  return `${sign}${cents} ¢`;
}

/** Format shift type label in French. */
export const SHIFT_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
  LATE_NIGHT: 'Nuit',
  BRUNCH: 'Brunch',
};

export function fmtShiftType(type: string): string {
  return SHIFT_TYPE_LABELS[type] ?? type;
}

/** Format computation method label. */
export function fmtComputationMethod(method: string): string {
  if (method === 'RULES') return 'Règles pondérées';
  if (method === 'ML') return 'IA assistée';
  return method;
}

/** Format role label in French (fallback to raw string). */
export const ROLE_LABELS: Record<string, string> = {
  SERVER: 'Serveur·euse',
  BARTENDER: 'Barman·aid',
  BUSSER: 'Runner',
  HOST: 'Accueil',
  COOK: 'Cuisinier',
  CHEF: 'Chef',
};

export function fmtRole(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Humanize explanation into a plain-language sentence. */
export function buildExplainSentence(params: {
  firstName: string;
  roleLabelFr: string;
  hoursWorked: number;
  salesGenerated: number;
  score: number;
  totalScore: number;
  finalAmount: number;
  poolTotal: number;
}): string {
  const {
    firstName,
    roleLabelFr,
    hoursWorked,
    salesGenerated,
    score,
    totalScore,
    finalAmount,
    poolTotal,
  } = params;

  const sharePct = poolTotal > 0 ? ((finalAmount / poolTotal) * 100).toFixed(1) : '0.0';
  const salesClause =
    salesGenerated > 0 ? ` et a généré $${salesGenerated.toFixed(0)} de ventes` : '';

  return (
    `${firstName} a travaillé ${hoursWorked.toFixed(1)} heure${hoursWorked !== 1 ? 's' : ''} comme ${roleLabelFr}${salesClause}. ` +
    `Avec un score de ${score.toFixed(2)} sur un total équipe de ${totalScore.toFixed(2)}, ` +
    `sa part représente ${sharePct}% du pool de $${poolTotal.toFixed(0)}.`
  );
}
