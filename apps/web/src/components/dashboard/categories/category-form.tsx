'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import type { MenuCategoryWithCount } from '../../../types/menu-category';

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z
    .string()
    .min(2, 'Nom requis (2 car. min)')
    .max(100, 'Nom trop long (100 car. max)')
    .transform((v) => v.trim()),
  displayOrder: z.coerce
    .number({ invalid_type_error: 'Ordre invalide' })
    .int('Ordre invalide')
    .min(0, 'Ordre invalide')
    .max(999, 'Ordre invalide')
    .optional(),
  active: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Présent → mode édition. Absent → mode création. */
  defaultValues?: MenuCategoryWithCount;
  onSubmit: (data: FormData) => void;
  loading?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CategoryForm({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  loading = false,
}: CategoryFormProps) {
  const isEdit = Boolean(defaultValues);

  // Double-submit guard — ref survives re-renders without causing one.
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      displayOrder: defaultValues?.displayOrder ?? 0,
      active: defaultValues?.active ?? true,
    },
  });

  useEffect(() => {
    submittingRef.current = false;
    if (!open) {
      reset();
      return;
    }
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        displayOrder: defaultValues.displayOrder,
        active: defaultValues.active,
      });
    }
  }, [open, defaultValues, reset]);

  function handleFormSubmit(data: FormData) {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    onSubmit(data);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      description={
        isEdit
          ? "Modifiez le nom ou l'ordre d'affichage de cette catégorie."
          : 'Créez une catégorie pour organiser les items de votre menu.'
      }
      size="sm"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Nom */}
        <Input
          label="Nom"
          placeholder="Plats du jour"
          error={errors.name?.message}
          autoFocus
          {...register('name')}
        />

        {/* Ordre d'affichage */}
        <Input
          label="Ordre d'affichage"
          type="number"
          min="0"
          max="999"
          placeholder="0"
          hint="Les catégories sont triées par ordre croissant"
          error={errors.displayOrder?.message}
          {...register('displayOrder')}
        />

        {/* Statut — affiché en mode édition uniquement */}
        {isEdit && (
          <div className="flex items-center gap-3">
            <input
              id="cat-active"
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border border-st-border"
              {...register('active')}
            />
            <label
              htmlFor="cat-active"
              className="cursor-pointer select-none text-sm font-sans text-st-pri"
            >
              Catégorie active
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button size="sm" type="submit" loading={loading}>
            {isEdit ? 'Sauvegarder' : 'Créer la catégorie'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
