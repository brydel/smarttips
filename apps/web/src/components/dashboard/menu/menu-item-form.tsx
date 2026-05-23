'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Select } from '../../ui/select';
import { Button } from '../../ui/button';
import { useMenuCategories } from '../../../hooks/use-menu-items';
import type { MenuItem } from '../../../types/menu-item';

/** Même mapping que menu/page.tsx — labels affichés dans le formulaire. */
const CAT_LABEL: Record<string, string> = {
  ENTREE: 'Entrée',
  MAIN: 'Plat',
  DESSERT: 'Dessert',
  DRINK: 'Boisson',
  SIDE: 'Accompagnement',
};

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
    imageUrl: z.string().url("URL d'image invalide").max(500).optional().or(z.literal('')),
    active: z.boolean().optional(),
  })
  .refine((d) => d.cost === undefined || d.cost === 0 || d.cost <= d.price, {
    message: 'Le coût ne peut pas dépasser le prix',
    path: ['cost'],
  });

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

  const { data: categories = [], isLoading: catLoading, isError: catError } = useMenuCategories();

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: CAT_LABEL[c.name] ?? c.name,
  }));

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
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

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
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

        {/* Category */}
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
                      ? 'Aucune catégorie disponible'
                      : 'Sélectionner une catégorie'
              }
              options={categoryOptions}
              value={field.value}
              onValueChange={field.onChange}
              disabled={catLoading || catError || categoryOptions.length === 0}
              error={errors.categoryId?.message}
            />
          )}
        />

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
  );
}
