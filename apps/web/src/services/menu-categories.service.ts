import { apiClient } from '../lib/api-client';
import type {
  MenuCategoryWithCount,
  CreateMenuCategoryPayload,
  UpdateMenuCategoryPayload,
} from '../types/menu-category';

const BASE = '/menu-categories';

export async function fetchManagedCategories(
  signal?: AbortSignal,
): Promise<MenuCategoryWithCount[]> {
  const { data } = await apiClient.get<MenuCategoryWithCount[]>(BASE, { signal });
  return data;
}

export async function createMenuCategory(
  payload: CreateMenuCategoryPayload,
): Promise<MenuCategoryWithCount> {
  const { data } = await apiClient.post<MenuCategoryWithCount>(BASE, payload);
  return data;
}

export async function updateMenuCategory(
  id: string,
  payload: UpdateMenuCategoryPayload,
): Promise<MenuCategoryWithCount> {
  const { data } = await apiClient.patch<MenuCategoryWithCount>(`${BASE}/${id}`, payload);
  return data;
}

export async function deleteMenuCategory(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}
