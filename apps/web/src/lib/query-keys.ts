/**
 * Central query-key registry.
 * Single source of truth for all TanStack Query cache keys — never import
 * a key from a hook file; always import from here.
 */
export const MENU_ITEMS_KEY = 'menu-items' as const;
export const MENU_CATEGORIES_KEY = 'menu-categories' as const;
export const MANAGED_CATEGORIES_KEY = 'managed-categories' as const;
