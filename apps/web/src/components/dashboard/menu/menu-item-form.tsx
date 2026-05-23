'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Select } from '../../ui/select';
import { Button } from '../../ui/button';
import { useMenuCategories } from '../../../hooks/use-menu-items';
import { useCreateMenuCategory } from '../../../hooks/use-menu-categories';
import { CategoryForm } from '../categories/category-form';
import { CAT_LABEL } from '../../../lib/category-labels';
import type { MenuItem } from '../../../types/menu-item';
import type { CategoryFormProps } from '../categories/category-form';

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z
  .object({
    name: z.string().min(2, 'Nom requis (2 car. min)').max(255),
    categoryId: z.string().uuid('Catégorie invalide').min(1, 'Catégorie requise'),
    price: z.coerce.number().min(0, 'Prix invalide').max(2000),
    cost: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number().min(0, 'Coût invalide').max(2000).optional(),
    ),
    description: z.string().max(1000).optional().or(z.literal('')),
    imageUrl: z
      .union([
        z.literal(''),
        z
          .string()
          .url("URL d'image invalide")
          .max(500, 'URL trop longue (500 car. max)')
          .refine((url) => /^https?:\/\//i.test(url), {
            message: "L'URL doit commencer par https://",
          }),
      ])
      .optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (d) => d.cost === undefined || d.cost === 0 || (d.cost as number) <= (d.price as number),
    {
      message: 'Le coût ne peut pas dépasser le prix',
      path: ['cost'],
    },
  );

type FormData = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface MenuItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: MenuItem;
  onSubmit: (data: FormData) => void;
  loading?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MenuItemForm({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  loading = false,
}: MenuItemFormProps) {
  const isEdit = Boolean(defaultValues);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const { data: categories = [], isLoading: catLoading, isError: catError } = useMenuCategories();
  const quickAddMutation = useCreateMenuCategory();

  // Memoized to avoid rebuilding the options array on every render.
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: CAT_LABEL[c.name] ?? c.name })),
    [categories],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      categoryId: defaultValues?.categoryId ?? '',
      price: defaultValues?.price ?? 0,
      cost: defaultValues?.cost ?? undefined,
      description: defaultValues?.description ?? '',
      imageUrl: defaultValues?.imageUrl ?? '',
      active: defaultValues?.active ?? true,
    },
  });

  const price = watch('price');
  const cost = watch('cost');
  const imageUrlVal = watch('imageUrl');

  // Deps use `.mutate` only (stable reference) to avoid stale closure on the
  // full mutation object which changes every render.
  const handleQuickAdd: CategoryFormProps['onSubmit'] = useCallback(
    (data) => {
      quickAddMutation.mutate(data, {
        onSuccess: (created) => {
          setValue('categoryId', created.id);
          setQuickAddOpen(false);
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quickAddMutation.mutate, setValue],
  );

  const margin =
    price && cost && Number(cost) > 0
      ? Math.round(((Number(price) - Number(cost)) / Number(price)) * 100)
      : null;

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        categoryId: defaultValues.categoryId,
        price: defaultValues.price,
        cost: defaultValues.cost ?? undefined,
        description: defaultValues.description ?? '',
        imageUrl: defaultValues.imageUrl ?? '',
        active: defaultValues.active,
      });
    }
  }, [open, defaultValues, reset]);

  // Guard: prevent closing the parent dialog while a quick-add is in progress.
  function handleParentOpenChange(nextOpen: boolean) {
    if (!nextOpen && quickAddOpen) return;
    onOpenChange(nextOpen);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleParentOpenChange}
        title={isEdit ? 'Modifier un item' : 'Ajouter un item au menu'}
        description={
          isEdit ? 'Modifiez les détails de cet item.' : 'Ajoutez un nouvel item à votre menu.'
        }
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {/* Name */}
          <Input
            label="Nom"
            placeholder="Tartare de boeuf"
            error={errors.name?.message}
            autoFocus
            {...register('name')}
          />

          {/* Category + quick-add */}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    label="Catégorie"
                    placeholder={
                      catLoading
                        ? 'Chargement…'
                        : catError
                          ? 'Erreur de chargement'
                          : categoryOptions.length === 0
                            ? 'Aucune catégorie — cliquez +'
                            : 'Sélectionner une catégorie'
                    }
                    options={categoryOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={catLoading || catError}
                    error={errors.categoryId?.message}
                  />
                )}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Créer une catégorie"
              title="Créer une nouvelle catégorie"
              className="shrink-0 mb-[1px]"
              onClick={() => setQuickAddOpen(true)}
            >
              <Plus size={13} />
            </Button>
          </div>

          {/* Price + Cost */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Prix ($)"
              type="number"
              step="0.01"
              min="0"
              placeholder="24.00"
              error={errors.price?.message}
              {...register('price')}
            />
            <div className="flex flex-col gap-1.5">
              <Input
                label="Coût ($)"
                type="number"
                step="0.01"
                min="0"
                placeholder="8.50"
                hint={margin !== null ? `Marge : ${margin}%` : 'Optionnel'}
                error={errors.cost?.message}
                {...register('cost')}
              />
            </div>
          </div>

          {/* Description */}
          <Input
            label="Description (optionnel)"
            placeholder="Boeuf Angus, câpres, jaune d'œuf…"
            error={errors.description?.message}
            {...register('description')}
          />

          {/* Image URL */}
          <div className="flex flex-col gap-1.5">
            <Input
              label="Image (URL optionnelle)"
              type="url"
              placeholder="https://cdn.example.com/tartare.jpg"
              error={errors.imageUrl?.message}
              {...register('imageUrl')}
            />
            {imageUrlVal && !errors.imageUrl && (
              <div className="w-full h-24 rounded-md overflow-hidden border border-st-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrlVal}
                  alt="Aperçu"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button size="sm" type="submit" loading={loading}>
              {isEdit ? 'Sauvegarder' : 'Ajouter au menu'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Quick-add catégorie — dialog imbriqué */}
      <CategoryForm
        open={quickAddOpen}
        onOpenChange={(next) => {
          // Block close while the mutation is in flight.
          if (!next && quickAddMutation.isPending) return;
          setQuickAddOpen(next);
        }}
        onSubmit={handleQuickAdd}
        loading={quickAddMutation.isPending}
      />
    </>
  );
}
