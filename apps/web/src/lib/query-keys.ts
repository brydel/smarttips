/**
 * Central query-key registry.
 * Single source of truth for all TanStack Query cache keys — never import
 * a key from a hook file; always import from here.
 */
export const MENU_ITEMS_KEY = 'menu-items' as const;
export const MENU_CATEGORIES_KEY = 'menu-categories' as const;
export const MANAGED_CATEGORIES_KEY = 'managed-categories' as const;

// ── Shifts ────────────────────────────────────────────────────────────────────
export const SHIFTS_KEY = 'shifts' as const;
export const SHIFT_KEY = 'shift' as const;

// ── Orders ────────────────────────────────────────────────────────────────────
export const ORDERS_KEY = 'orders' as const;

// ── Tip pools ─────────────────────────────────────────────────────────────────
export const TIP_POOLS_KEY = 'tip-pools' as const;

// ── Employees ─────────────────────────────────────────────────────────────────
export const EMPLOYEES_KEY = 'employees' as const;

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const DASHBOARD_STATS_KEY = 'dashboard-stats' as const;
