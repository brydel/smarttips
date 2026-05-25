/**
 * Employee space formatters — BIS-23.
 * All monetary values come in as strings (Prisma Decimal → JSON).
 */
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Money ─────────────────────────────────────────────────────────────────────

export function fmtMoney(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtMoneyShort(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  return `${n.toFixed(2)} $`;
}

// ── Date / time ───────────────────────────────────────────────────────────────

export function fmtShiftDate(iso: string): string {
  try {
    const d = parseISO(iso.split('T')[0] ?? iso);
    const label = format(d, 'EEEE d MMMM', { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return iso;
  }
}

export function fmtShiftDateShort(iso: string): string {
  try {
    const d = parseISO(iso.split('T')[0] ?? iso);
    return format(d, 'd MMM yyyy', { locale: fr });
  } catch {
    return iso;
  }
}

export function fmtTrendDate(iso: string): string {
  try {
    const d = parseISO(iso);
    return format(d, 'd MMM', { locale: fr });
  } catch {
    return iso;
  }
}

// ── Shift type ────────────────────────────────────────────────────────────────

const SHIFT_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
  LATE_NIGHT: 'Soirée',
};

export function fmtShiftType(type: string): string {
  return SHIFT_TYPE_LABELS[type] ?? type;
}

// ── Role ──────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SERVER: 'Serveur',
  BARTENDER: 'Barman',
  BUSSER: 'Commis',
  HOST: 'Hôte',
  COOK: 'Cuisinier',
  CHEF: 'Chef',
};

export function fmtRole(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

// ── Hours ─────────────────────────────────────────────────────────────────────

export function fmtHours(hours: string | number | null | undefined): string {
  if (hours == null || hours === '') return '—';
  const n = typeof hours === 'string' ? parseFloat(hours) : hours;
  if (!isFinite(n)) return '—';
  return `${n.toFixed(1)}h`;
}

// ── Percentage ────────────────────────────────────────────────────────────────

export function fmtPercent(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

// ── Explanation builder ───────────────────────────────────────────────────────

interface ExplainParams {
  roleCoefficient?: string;
  employeeCoefficient?: string;
  hoursWorked?: string;
  salesBonus?: string;
}

export function buildShortExplain(params: ExplainParams): string {
  const roleCoef = params.roleCoefficient ? parseFloat(params.roleCoefficient) : null;
  const empCoef = params.employeeCoefficient ? parseFloat(params.employeeCoefficient) : null;
  const hours = params.hoursWorked ? parseFloat(params.hoursWorked) : null;
  const bonus = params.salesBonus ? parseFloat(params.salesBonus) : null;

  const parts: string[] = [];

  if (roleCoef !== null) {
    parts.push(`coef. rôle ×${roleCoef.toFixed(2)}`);
  }
  if (empCoef !== null && empCoef !== 1) {
    parts.push(`coef. perso ×${empCoef.toFixed(2)}`);
  }
  if (hours !== null) {
    parts.push(`${hours.toFixed(1)}h travaillées`);
  }
  if (bonus !== null && bonus > 1.0001) {
    parts.push(`bonus ventes ×${bonus.toFixed(2)}`);
  }

  if (parts.length === 0) return 'Calcul selon les règles du restaurant.';
  return parts.join(' · ') + ' = votre part.';
}
