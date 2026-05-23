import type { BadgeTone } from '../components/ui/badge';

/**
 * Maps DB category name keys → human-readable UI labels.
 * Shared across menu/page.tsx, categories/page.tsx and menu-item-form.tsx
 * to keep wording consistent everywhere.
 */
export const CAT_LABEL: Record<string, string> = {
  ENTREE: 'Entrée',
  MAIN: 'Plat',
  DESSERT: 'Dessert',
  DRINK: 'Boisson',
  SIDE: 'Accompagnement',
};

/**
 * Maps DB category name keys → badge tone.
 * Falls back to 'neutral' for unknown keys.
 */
export const CAT_TONE: Record<string, BadgeTone> = {
  ENTREE: 'indigo',
  MAIN: 'emerald',
  DESSERT: 'gold',
  DRINK: 'neutral',
  SIDE: 'neutral',
};
