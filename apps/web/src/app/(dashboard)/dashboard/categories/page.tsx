'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { DataTable, type Column } from '../../../../components/ui/data-table';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { CategoryForm } from '../../../../components/dashboard/categories/category-form';
import {
  useManagedCategories,
  useCreateMenuCategory,
  useUpdateMenuCategory,
  useDeleteMenuCategory,
} from '../../../../hooks/use-menu-categories';
import type { MenuCategoryWithCount } from '../../../../types/menu-category';
import type { CategoryFormProps } from '../../../../components/dashboard/categories/category-form';

type FormSubmitData = Parameters<CategoryFormProps['onSubmit']>[0];

// ── KPI stat ─────────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9.5px] uppercase tracking-widest text-st-dim">{label}</p>
      <p className="text-sm font-medium text-st-hi font-sans">{value}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MenuCategoryWithCount | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<MenuCategoryWithCount | undefined>();

  const { data: categories = [], isLoading, isError } = useManagedCategories();
  const createMutation = useCreateMenuCategory();
  const updateMutation = useUpdateMenuCategory();
  const deleteMutation = useDeleteMenuCategory();

  const openCreate = useCallback(() => {
    setEditTarget(undefined);
    setFormOpen(true);
  }, []);
  const openEdit = useCallback((cat: MenuCategoryWithCount) => {
    setEditTarget(cat);
    setFormOpen(true);
  }, []);

  function handleFormSubmit(data: FormSubmitData) {
    if (createMutation.isPending || updateMutation.isPending) return;
    if (editTarget) {
      updateMutation.mutate(
        { id: editTarget.id, payload: data },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(undefined) });
  }

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = useMemo<Column<MenuCategoryWithCount>[]>(
    () => [
      {
        key: 'name',
        header: 'Catégorie',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-st-raised border border-st-border shrink-0">
              <Tag size={12} className="text-st-dim" />
            </div>
            <span className="text-sm font-medium text-st-hi font-sans">{row.name}</span>
          </div>
        ),
      },
      {
        key: 'displayOrder',
        header: 'Ordre',
        sortable: true,
        className: 'text-right',
        headerClassName: 'text-right',
        render: (row) => (
          <span className="font-mono text-sm text-st-sec tabular-nums">{row.displayOrder}</span>
        ),
      },
      {
        key: 'items',
        header: 'Items',
        className: 'text-right',
        headerClassName: 'text-right',
        render: (row) => (
          <span
            className={[
              'font-mono text-sm tabular-nums',
              row._count.items > 0 ? 'text-st-hi' : 'text-st-dim',
            ].join(' ')}
          >
            {row._count.items}
          </span>
        ),
      },
      {
        key: 'active',
        header: 'Statut',
        render: (row) => (
          <Badge tone={row.active ? 'emerald' : 'neutral'}>
            {row.active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'text-right',
        render: (row) => {
          const hasItems = row._count.items > 0;
          const isUpdating = updateMutation.isPending && updateMutation.variables?.id === row.id;

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Modifier"
                disabled={isUpdating}
                onClick={() => openEdit(row)}
              >
                <Pencil size={13} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Supprimer"
                className="hover:text-st-danger hover:border-st-danger/30"
                disabled={hasItems}
                title={
                  hasItems
                    ? `${row._count.items} item(s) actif(s) — déplacez-les avant de supprimer`
                    : undefined
                }
                onClick={() => setDeleteTarget(row)}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          );
        },
      },
    ],
    [openEdit, updateMutation.isPending, updateMutation.variables],
  );

  // ── KPI stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.active).length;
    const withItems = categories.filter((c) => c._count.items > 0).length;
    return { total, active, withItems };
  }, [categories]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <header className="flex items-center justify-between border-b border-st-border bg-st-bg px-6 py-4">
        <div>
          <h1 className="font-display text-2xl text-st-hi leading-tight">Catégories</h1>
          <p className="text-sm text-st-sec font-sans mt-0.5">
            {categories.length} catégorie{categories.length !== 1 ? 's' : ''} · organisez votre menu
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} />
          <span className="hidden sm:inline">Ajouter une catégorie</span>
          <span className="sm:hidden">Ajouter</span>
        </Button>
      </header>

      {/* KPI bar */}
      {categories.length > 0 && (
        <div className="flex gap-6 border-b border-st-border px-6 py-3 bg-st-card">
          <Stat label="Total" value={String(stats.total)} />
          <Stat label="Actives" value={String(stats.active)} />
          <Stat label="Avec items" value={String(stats.withItems)} />
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <DataTable
          data={categories}
          columns={columns}
          loading={isLoading}
          isError={isError}
          searchPlaceholder="Rechercher une catégorie…"
          searchKeys={['name']}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-st-sec font-sans">Aucune catégorie créée</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                Créer la première catégorie
              </Button>
            </div>
          }
        />
      </div>

      {/* Form dialog */}
      <CategoryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultValues={editTarget}
        onSubmit={handleFormSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(undefined)}
        title="Supprimer la catégorie"
        description={
          deleteTarget ? `Êtes-vous sûr de vouloir supprimer « ${deleteTarget.name} » ?` : ''
        }
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
