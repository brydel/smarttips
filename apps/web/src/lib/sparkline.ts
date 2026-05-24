/**
 * Shared sparkline utilities — single source of truth.
 * Extracted from employee-card.tsx + team-drawer.tsx to eliminate
 * duplication (QUAL-C2 / ARCH-C2) and the silent NaN bug in the drawer
 * copy that lacked normalizeCoefficient (ROB-C1).
 */
import type { Employee } from '../types/employee';

/**
 * Safely coerces a coefficient value to a finite number.
 * Needed because Prisma decimal columns can arrive as strings from the API.
 */
export function normalizeCoefficient(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 1);
  return Number.isFinite(n) ? n : 1;
}

/**
 * Generates a deterministic 8-point sparkline seeded on the employee's
 * coefficient, firstName, and lastName. Used as a visual proxy until real
 * per-shift tip history is available from the API.
 */
export function genEmployeeSparkline(
  emp: Pick<Employee, 'coefficient' | 'firstName' | 'lastName'>,
): number[] {
  const coeff = normalizeCoefficient(emp.coefficient);
  const base = coeff * 80;
  const seed = (emp.firstName.charCodeAt(0) || 65) + (emp.lastName.charCodeAt(0) || 65);

  return Array.from({ length: 8 }, (_, k) => {
    const noise = ((seed * (k + 1)) % 17) - 8;
    return Math.max(40, base + k * (base > 88 ? 5 : 3) + noise);
  });
}
