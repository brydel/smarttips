import { apiClient } from '../lib/api-client';
import type {
  MenuItem,
  MenuCategoryEntity,
  CreateMenuItemPayload,
  UpdateMenuItemPayload,
  MenuItemFilters,
} from '../types/menu-item';

const BASE = '/menu-items';

/**
 * NestJS @IsOptional() only skips validation when a field is null | undefined,
 * not when it is an empty string.  The form uses '' as the empty-field sentinel
 * (via `.or(z.literal(''))` in Zod), so we strip those fields before sending
 * to prevent spurious 400s from @IsNotEmpty / @IsUrl decorators.
 */
function cleanOptionalStrings<T extends { description?: string; imageUrl?: string }>(
  payload: T,
): T {
  const out = { ...payload };
  if (out.description === '') delete out.description;
  if (out.imageUrl === '') delete out.imageUrl;
  return out;
}

export async function fetchMenuItems(
  filters: MenuItemFilters = {},
  signal?: AbortSignal,
): Promise<MenuItem[]> {
  const params = new URLSearchParams();
  if (filters.categoryId !== undefined) params.set('categoryId', filters.categoryId);
  if (filters.active !== undefined) params.set('active', String(filters.active));

  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const { data } = await apiClient.get<MenuItem[]>(url, { signal });
  return data;
}

export async function fetchMenuCategories(signal?: AbortSignal): Promise<MenuCategoryEntity[]> {
  const { data } = await apiClient.get<MenuCategoryEntity[]>(`${BASE}/categories`, { signal });
  return data;
}

export async function createMenuItem(payload: CreateMenuItemPayload): Promise<MenuItem> {
  const { data } = await apiClient.post<MenuItem>(BASE, cleanOptionalStrings(payload));
  return data;
}

export async function updateMenuItem(
  id: string,
  payload: UpdateMenuItemPayload,
): Promise<MenuItem> {
  const { data } = await apiClient.patch<MenuItem>(`${BASE}/${id}`, cleanOptionalStrings(payload));
  return data;
}

export async function deleteMenuItem(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}
