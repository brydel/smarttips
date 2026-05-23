'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, ImageOff } from 'lucide-react';
import { DataTable, type Column } from '../../../../components/ui/data-table';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Select } from '../../../../components/ui/select';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { MenuItemForm } from '../../../../components/dashboard/menu/menu-item-form';
import {
  useMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useMenuCategories,
} from '../../../../hooks/use-menu-items';
import type { MenuItem, CreateMenuItemPayload } from '../../../../types/menu-item';
import type { MenuItemFormProps } from '../../../../components/dashboard/menu/menu-item-form';
import { CAT_LABEL, CAT_TONE } from '../../../../lib/category-labels';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Inactifs' },
];

/** Returns gross margin % or null when cost data is insufficient. */
function margin(price: number | string, cost: number | string | null): number | null {
  const p = Number(price);
  const c = Number(cost);
  if (cost === null || isNaN(c) || c <= 0 || isNaN(p) || p <= 0) return null;
  return Math.round(((p - c) / p) * 100);
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[9.5px] uppercase tracking-widest text-st-dim">{label}</p>
      <p
        className={[
          'text-sm text-st-hi',
          mono ? 'font-mono tabular-nums' : 'font-sans font-medium',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

type FormSubmitData = Parameters<MenuItemFormProps['onSubmit']>[0];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MenuItem | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | undefined>();

  const { data: categories = [] } = useMenuCategories();

  const catFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'Toutes les catégories' },
      ...categories.map((c) => ({
        value: c.id,
        label: CAT_LABEL[c.name] ?? c.name,
      })),
    ],
    [categories],
  );

  const filters = useMemo(
    () => ({
      categoryId: catFilter !== 'all' ? catFilter : undefined,
      active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    }),
    [catFilter, statusFilter],
  );

  const { data: items = [], isLoading, isError } = useMenuItems(filters);
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();

  const openCreate = useCallback(() => {
    setEditTarget(undefined);
    setFormOpen(true);
  }, []);
  const openEdit = useCallback((item: MenuItem) => {
    setEditTarget(item);
    setFormOpen(true);
  }, []);

  function handleFormSubmit(data: FormSubmitData) {
    if (editTarget) {
      updateMutation.mutate(
        { id: editTarget.id, payload: data },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createMutation.mutate(data as CreateMenuItemPayload, { onSuccess: () => setFormOpen(false) });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(undefined) });
  }

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = useMemo<Column<MenuItem>[]>(
    () => [
      {
        key: 'name',
        header: 'Item',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-3">
            {/* Image thumbnail */}
            <div className="w-9 h-9 rounded-md overflow-hidden shrink-0 bg-st-raised border border-st-border flex items-center justify-center">
              {row.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.imageUrl}
                  alt={row.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = 'none';
                    el.parentElement?.classList.add('img-error');
                  }}
                />
              ) : (
                <ImageOff size={13} className="text-st-dim" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-st-hi font-sans">{row.name}</p>
              {row.description && (
                <p className="text-[11px] text-st-sec font-sans truncate max-w-[180px]">
                  {row.description}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Catégorie',
        sortable: true,
        render: (row) => {
          const name = row.category?.name ?? '';
          return <Badge tone={CAT_TONE[name] ?? 'neutral'}>{CAT_LABEL[name] ?? name}</Badge>;
        },
      },
      {
        key: 'price',
        header: 'Prix',
        sortable: true,
        className: 'text-right',
        headerClassName: 'text-right',
        render: (row) => (
          <span className="font-mono text-sm text-st-hi tabular-nums">
            {Number(row.price).toFixed(2)} $
          </span>
        ),
      },
      {
        key: 'cost',
        header: 'Coût',
        sortable: true,
        className: 'text-right',
        headerClassName: 'text-right',
        render: (row) =>
          row.cost !== null ? (
            <span className="font-mono text-sm text-st-sec tabular-nums">
              {Number(row.cost).toFixed(2)} $
            </span>
          ) : (
            <span className="text-st-dim">—</span>
          ),
      },
      {
        key: 'margin',
        header: 'Marge',
        className: 'text-right',
        headerClassName: 'text-right',
        render: (row) => {
          const m = margin(row.price, row.cost);
          if (m === null) return <span className="text-st-dim">—</span>;
          return (
            <span
              className={[
                'inline-flex items-center gap-1 font-mono text-sm tabular-nums',
                m >= 60 ? 'text-st-emerald-glow' : m >= 40 ? 'text-st-gold-glow' : 'text-st-sec',
              ].join(' ')}
            >
              <TrendingUp size={11} />
              {m}%
            </span>
          );
        },
      },
      {
        key: 'active',
        header: 'Statut',
        render: (row) => (
          <Badge tone={row.active ? 'emerald' : 'neutral'}>
            {row.active ? 'Actif' : 'Inactif'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Modifier"
              disabled={updateMutation.isPending && updateMutation.variables?.id === row.id}
              onClick={() => openEdit(row)}
            >
              <Pencil size={13} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Supprimer"
              className="hover:text-st-danger hover:border-st-danger/30"
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openEdit, updateMutation.isPending, updateMutation.variables, deleteMutation.isPending],
  );

  // ── KPI stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalActive = items.filter((i) => i.active).length;
    const avgPrice = items.length
      ? items.reduce((s, i) => s + Number(i.price), 0) / items.length
      : 0;
    const itemsWithCost = items.filter((i) => i.cost !== null && Number(i.cost) > 0);
    const avgMargin = itemsWithCost.length
      ? itemsWithCost.reduce((s, i) => s + (margin(i.price, i.cost) ?? 0), 0) / itemsWithCost.length
      : 0;
    return { totalActive, avgPrice, avgMargin };
  }, [items]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <header className="flex items-center justify-between border-b border-st-border bg-st-bg px-6 py-4">
        <div>
          <h1 className="font-display text-2xl text-st-hi leading-tight">Menu Engineering</h1>
          <p className="text-sm text-st-sec font-sans mt-0.5">
            {items.length} item{items.length !== 1 ? 's' : ''} · optimisez vos marges et catégories
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} />
          <span className="hidden sm:inline">Ajouter un item</span>
          <span className="sm:hidden">Ajouter</span>
        </Button>
      </header>

      {/* KPI bar */}
      {items.length > 0 && (
        <div className="flex gap-6 border-b border-st-border px-6 py-3 bg-st-card">
          <Stat label="Actifs" value={`${stats.totalActive} / ${items.length}`} />
          <Stat label="Prix moyen" value={`${Number(stats.avgPrice).toFixed(2)} $`} mono />
          {stats.avgMargin > 0 && (
            <Stat label="Marge moyenne" value={`${Math.round(stats.avgMargin)}%`} mono />
          )}
        </div>
      )}

      {/* Filters + table */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-56">
            <Select
              placeholder="Toutes les catégories"
              value={catFilter}
              onValueChange={setCatFilter}
              options={catFilterOptions}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              placeholder="Tous les statuts"
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        </div>

        <DataTable
          data={items}
          columns={columns}
          loading={isLoading}
          isError={isError}
          searchPlaceholder="Rechercher un item…"
          searchKeys={['name', 'description']}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-st-sec font-sans">Aucun item dans ce menu</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                Ajouter le premier item
              </Button>
            </div>
          }
        />
      </div>

      {/* Form dialog */}
      <MenuItemForm
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
        title="Supprimer l'item"
        description={
          deleteTarget
            ? `Êtes-vous sûr de vouloir supprimer « ${deleteTarget.name} » du menu ?`
            : ''
        }
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
