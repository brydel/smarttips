import { Prisma } from '@prisma/client';

import { EmployeeWalletExplanation } from './types/employee-wallet.types';

/**
 * Redaction de l'explication de distribution exposable à l'employé (BIS-55).
 * Extraite du portefeuille pour être réutilisée par les litiges (BIS-56) :
 * le snapshot d'évidence d'un litige passe par la même liste blanche.
 *
 * Clés exposables (liste blanche stricte). Jamais de spread du JSON brut :
 * les internals moteur (source, schemaVersion, engineVersion, policyVersion)
 * et ML (modelVersion, mlWeight, mlShare, rulesShare, blendAlpha)
 * ne doivent pas sortir.
 */
export const EXPLANATION_STRING_KEYS = [
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

export const EXPLANATION_BOOLEAN_KEYS = ['capApplied', 'minimumApplied'] as const;

/**
 * Copie clé par clé sur liste blanche — jamais de spread du JSON brut.
 * Les lignes ML ne livrent que les champs de base (part, montants, plafonds).
 */
export function redactExplanation(value: Prisma.JsonValue): EmployeeWalletExplanation | null {
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
