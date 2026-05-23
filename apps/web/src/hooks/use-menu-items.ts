import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createMenuItem,
  deleteMenuItem,
  fetchMenuCategories,
  fetchMenuItems,
  updateMenuItem,
} from '../services/menu.service';
import { MANAGED_CATEGORIES_KEY, MENU_CATEGORIES_KEY, MENU_ITEMS_KEY } from '../lib/query-keys';
import { extractErrorMessage } from '../lib/errors';
import type {
  CreateMenuItemPayload,
  MenuCategoryEntity,
  MenuItem,
  MenuItemFilters,
  UpdateMenuItemPayload,
} from '../types/menu-item';

// Re-export so existing callers that import keys from this file keep working.
export { MENU_ITEMS_KEY, MENU_CATEGORIES_KEY };

export function useMenuItems(filters: MenuItemFilters = {}) {
  return useQuery({
    queryKey: [MENU_ITEMS_KEY, filters],
    queryFn: ({ signal }) => fetchMenuItems(filters, signal),
  });
}

export function useMenuCategories() {
  return useQuery<MenuCategoryEntity[]>({
    queryKey: [MENU_CATEGORIES_KEY],
    queryFn: ({ signal }) => fetchMenuCategories(signal),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMenuItemPayload) => createMenuItem(payload),
    onSuccess: () => {
      toast.success('Item ajouté au menu');
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Erreur lors de l'ajout de l'item"));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [MENU_ITEMS_KEY] });
      // Item count on categories changes → keep managed-categories in sync.
      void qc.invalidateQueries({ queryKey: [MANAGED_CATEGORIES_KEY] });
    },
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMenuItemPayload }) =>
      updateMenuItem(id, payload),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: [MENU_ITEMS_KEY] });
      const previous = qc.getQueriesData<MenuItem[]>({ queryKey: [MENU_ITEMS_KEY] });
      qc.setQueriesData<MenuItem[]>({ queryKey: [MENU_ITEMS_KEY] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((item) => (item.id === id ? { ...item, ...payload } : item));
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success('Item mis à jour');
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.previous) {
        for (const [key, data] of ctx.previous) {
          qc.setQueryData(key, data);
        }
      }
      toast.error(extractErrorMessage(err, 'Erreur lors de la mise à jour'));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [MENU_ITEMS_KEY] });
    },
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [MENU_ITEMS_KEY] });
      const previous = qc.getQueriesData<MenuItem[]>({ queryKey: [MENU_ITEMS_KEY] });
      qc.setQueriesData<MenuItem[]>({ queryKey: [MENU_ITEMS_KEY] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item) => item.id !== id);
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success('Item supprimé du menu');
    },
    onError: (err: unknown, _id, ctx) => {
      if (ctx?.previous) {
        for (const [key, data] of ctx.previous) {
          qc.setQueryData(key, data);
        }
      }
      toast.error(extractErrorMessage(err, 'Erreur lors de la suppression'));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [MENU_ITEMS_KEY] });
      // Item count on categories changes → keep managed-categories in sync.
      void qc.invalidateQueries({ queryKey: [MANAGED_CATEGORIES_KEY] });
    },
  });
}
