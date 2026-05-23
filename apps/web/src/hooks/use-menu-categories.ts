import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createMenuCategory,
  deleteMenuCategory,
  fetchManagedCategories,
  updateMenuCategory,
} from '../services/menu-categories.service';
import { MANAGED_CATEGORIES_KEY, MENU_CATEGORIES_KEY, MENU_ITEMS_KEY } from '../lib/query-keys';
import { extractErrorMessage } from '../lib/errors';
import type {
  CreateMenuCategoryPayload,
  MenuCategoryWithCount,
  UpdateMenuCategoryPayload,
} from '../types/menu-category';

// ── Queries ───────────────────────────────────────────────────────────────────

export function useManagedCategories() {
  return useQuery<MenuCategoryWithCount[]>({
    queryKey: [MANAGED_CATEGORIES_KEY],
    queryFn: ({ signal }) => fetchManagedCategories(signal),
    staleTime: 30_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateMenuCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMenuCategoryPayload) => createMenuCategory(payload),
    onSuccess: () => {
      toast.success('Catégorie créée');
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, 'Erreur lors de la création'));
    },
    onSettled: () => {
      // Invalidate both caches: management page + item-form dropdown.
      void qc.invalidateQueries({ queryKey: [MANAGED_CATEGORIES_KEY] });
      void qc.invalidateQueries({ queryKey: [MENU_CATEGORIES_KEY] });
    },
  });
}

export function useUpdateMenuCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMenuCategoryPayload }) =>
      updateMenuCategory(id, payload),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: [MANAGED_CATEGORIES_KEY] });
      // getQueriesData covers all matching cache entries (future-proof for filters).
      const previous = qc.getQueriesData<MenuCategoryWithCount[]>({
        queryKey: [MANAGED_CATEGORIES_KEY],
      });
      qc.setQueriesData<MenuCategoryWithCount[]>({ queryKey: [MANAGED_CATEGORIES_KEY] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((cat) => (cat.id === id ? { ...cat, ...payload } : cat));
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success('Catégorie mise à jour');
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
      void qc.invalidateQueries({ queryKey: [MANAGED_CATEGORIES_KEY] });
      void qc.invalidateQueries({ queryKey: [MENU_CATEGORIES_KEY] });
      // Category name change affects menu items that include the category relation.
      void qc.invalidateQueries({ queryKey: [MENU_ITEMS_KEY] });
    },
  });
}

export function useDeleteMenuCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMenuCategory(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [MANAGED_CATEGORIES_KEY] });
      const previous = qc.getQueriesData<MenuCategoryWithCount[]>({
        queryKey: [MANAGED_CATEGORIES_KEY],
      });
      qc.setQueriesData<MenuCategoryWithCount[]>({ queryKey: [MANAGED_CATEGORIES_KEY] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((cat) => cat.id !== id);
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success('Catégorie supprimée');
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
      void qc.invalidateQueries({ queryKey: [MANAGED_CATEGORIES_KEY] });
      void qc.invalidateQueries({ queryKey: [MENU_CATEGORIES_KEY] });
    },
  });
}
