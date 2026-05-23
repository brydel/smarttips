// ── Category ──────────────────────────────────────────────────────────────────
/** Full MenuCategory entity as returned by the API (include: { category: true }). */
export interface MenuCategoryEntity {
  id: string;
  tenantId: string;
  name: string;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Menu item ─────────────────────────────────────────────────────────────────
/** MenuItem as returned by the API with the joined category relation. */
export interface MenuItem {
  id: string;
  tenantId: string;
  categoryId: string; // UUID FK
  category: MenuCategoryEntity; // joined relation (include: { category: true })
  name: string;
  description: string | null;
  price: number; // Decimal → string at runtime; coerce with Number()
  cost: number | null;
  active: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Payloads ──────────────────────────────────────────────────────────────────
export interface CreateMenuItemPayload {
  name: string;
  categoryId: string; // UUID — PK of MenuCategory
  price: number;
  cost?: number;
  description?: string;
  imageUrl?: string;
  active?: boolean;
}

export type UpdateMenuItemPayload = Partial<CreateMenuItemPayload>;

// ── Filters ───────────────────────────────────────────────────────────────────
export interface MenuItemFilters {
  categoryId?: string; // UUID (maps to FilterMenuItemsDto.categoryId)
  active?: boolean;
}
