// ── Category entity ───────────────────────────────────────────────────────────
/** Full MenuCategory entity as returned by the API. */
export interface MenuCategoryEntity {
  id: string;
  tenantId: string;
  name: string;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Managed category ──────────────────────────────────────────────────────────
/** MenuCategory enriched with item count from GET /menu-categories. */
export interface MenuCategoryWithCount extends MenuCategoryEntity {
  _count: { items: number };
}

// ── Payloads ──────────────────────────────────────────────────────────────────
export interface CreateMenuCategoryPayload {
  name: string;
  displayOrder?: number;
  active?: boolean;
}

export type UpdateMenuCategoryPayload = Partial<CreateMenuCategoryPayload>;
