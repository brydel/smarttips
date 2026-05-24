/**
 * Single source of truth for role display configuration.
 *
 * Eliminates the ROLE_DESIGN / ROLE_META / ROLE_LABELS / ROLE_COLORS
 * duplication that existed across 6+ files (ARCH-C1 / QUAL-H6).
 *
 * Import `ROLE_CONFIG[role]` wherever you need label, color, cssKey, etc.
 */
import type { EmployeeRole } from '../types/employee';

export interface RoleConfig {
  /** Full label used in main UI (e.g. drawer, cards) */
  label: string;
  /** Short label for compact contexts (assignment rows, dropdowns) */
  labelShort: string;
  /** Plural label for filter tabs */
  plural: string;
  /** Accent color hex — matches `--role-c` in team-role-* CSS classes */
  color: string;
  /** Background tint (rgba) for chips / role gradient */
  tint: string;
  /** CSS class suffix: `.team-role-${cssKey}` */
  cssKey: string;
}

export const ROLE_CONFIG: Record<EmployeeRole, RoleConfig> = {
  SERVER: {
    label: 'Serveur·euse',
    labelShort: 'Serveur',
    plural: 'Serveurs',
    color: '#818CF8',
    tint: 'rgba(99,102,241,.10)',
    cssKey: 'server',
  },
  BARTENDER: {
    label: 'Bar',
    labelShort: 'Barman',
    plural: 'Bar',
    color: '#E8C49A',
    tint: 'rgba(212,165,116,.12)',
    cssKey: 'bar',
  },
  HOST: {
    label: 'Accueil',
    labelShort: 'Hôte',
    plural: 'Accueil',
    color: '#34D399',
    tint: 'rgba(16,185,129,.10)',
    cssKey: 'host',
  },
  COOK: {
    label: 'Cuisine',
    labelShort: 'Cuisinier',
    plural: 'Cuisine',
    color: '#BCB19A',
    tint: 'rgba(188,177,154,.10)',
    cssKey: 'kitchen',
  },
  BUSSER: {
    label: 'Runner',
    labelShort: 'Runner',
    plural: 'Runners',
    color: '#8892B0',
    tint: 'rgba(136,146,176,.10)',
    cssKey: 'runner',
  },
};

/** Ordered list of roles for UI display (tabs, selectors) — matches design tab order. */
export const ROLE_ORDER: EmployeeRole[] = ['SERVER', 'BARTENDER', 'HOST', 'COOK', 'BUSSER'];
