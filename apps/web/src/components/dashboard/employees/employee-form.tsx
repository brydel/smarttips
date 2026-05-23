'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Select } from '../../ui/select';
import { Button } from '../../ui/button';
import { EMPLOYEE_ROLES, type Employee, type EmployeeRole } from '../../../types/employee';

// ── Schemas ────────────────────────────────────────────────────────────────
// Base fields shared between create and edit (mirrors CreateEmployeeDto minus hireDate).
const baseFields = {
  firstName: z.string().min(2, 'Min 2 caractères').max(100, 'Max 100 caractères'),
  lastName: z.string().min(2, 'Min 2 caractères').max(100, 'Max 100 caractères'),
  email: z.string().email('Email invalide').max(254, 'Email trop long'),
  role: z.enum(EMPLOYEE_ROLES, { required_error: 'Rôle requis' }),
  hourlyWage: z.coerce
    .number({ invalid_type_error: 'Salaire invalide' })
    .min(0, 'Salaire invalide')
    .max(200, 'Max 200 $/h'),
  coefficient: z.coerce.number().min(0).max(10).optional(),
};

// For create: hireDate is required (API: @IsNotEmpty @IsDateString).
// For edit  : hireDate is not accepted by the API (omitted from UpdateEmployeeDto).
function buildSchema(isEdit: boolean) {
  const obj = isEdit
    ? z.object(baseFields)
    : z.object({ ...baseFields, hireDate: z.string().min(1, "Date d'embauche requise") });
  return obj;
}

// The union type covering both modes (hireDate is optional at the type level).
type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  role: EmployeeRole;
  hourlyWage: number;
  coefficient?: number;
  hireDate?: string;
};

// ── Role select options ────────────────────────────────────────────────────
const ROLE_OPTIONS = EMPLOYEE_ROLES.map((r) => ({
  value: r,
  label: {
    SERVER: 'Serveur',
    BUSSER: 'Runner',
    BARTENDER: 'Barman',
    COOK: 'Cuisinier',
    HOST: 'Hôte',
  }[r],
}));

// ── Props ──────────────────────────────────────────────────────────────────
export interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Employee;
  onSubmit: (data: FormData) => void;
  loading?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────
export function EmployeeForm({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  loading = false,
}: EmployeeFormProps) {
  const isEdit = Boolean(defaultValues);

  // Schema changes between create and edit — rebuild only when mode changes.
  const schema = useMemo(() => buildSchema(isEdit), [isEdit]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: defaultValues?.firstName ?? '',
      lastName: defaultValues?.lastName ?? '',
      email: defaultValues?.email ?? '',
      role: defaultValues?.role ?? 'SERVER',
      hourlyWage: defaultValues?.hourlyWage ?? 16.5,
      coefficient: defaultValues?.coefficient,
      hireDate: defaultValues?.hireDate?.slice(0, 10) ?? '',
    },
  });

  // Reset when dialog opens/closes or the target employee changes.
  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    reset({
      firstName: defaultValues?.firstName ?? '',
      lastName: defaultValues?.lastName ?? '',
      email: defaultValues?.email ?? '',
      role: defaultValues?.role ?? 'SERVER',
      hourlyWage: defaultValues?.hourlyWage ?? 16.5,
      coefficient: defaultValues?.coefficient,
      hireDate: defaultValues?.hireDate?.slice(0, 10) ?? '',
    });
  }, [open, defaultValues, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Modifier un employé' : 'Ajouter un employé'}
      description={
        isEdit
          ? "Mettez à jour les informations de l'employé."
          : 'Remplissez les informations du nouvel employé.'
      }
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prénom"
            placeholder="Camille"
            error={errors.firstName?.message}
            autoFocus
            {...register('firstName')}
          />
          <Input
            label="Nom"
            placeholder="Pereira"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        {/* Email — always required (API: @IsNotEmpty @IsEmail) */}
        <Input
          label="Email"
          type="email"
          placeholder="camille@restaurant.com"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Role */}
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select
              label="Rôle"
              options={ROLE_OPTIONS}
              value={field.value}
              onValueChange={(v) => field.onChange(v as EmployeeRole)}
              error={errors.role?.message}
            />
          )}
        />

        {/* Wage + coefficient */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Salaire horaire ($)"
            type="number"
            step="0.25"
            min="0"
            max="200"
            placeholder="16.50"
            error={errors.hourlyWage?.message}
            {...register('hourlyWage')}
          />
          <Input
            label="Coefficient"
            type="number"
            step="0.05"
            min="0"
            max="10"
            placeholder="1.00"
            hint="Multiplicateur de pourboire (0 – 10)"
            error={errors.coefficient?.message}
            {...register('coefficient')}
          />
        </div>

        {/* Hire date — only for create; omitted from UpdateEmployeeDto */}
        {!isEdit && (
          <Input
            label="Date d'embauche"
            type="date"
            error={errors.hireDate?.message}
            {...register('hireDate')}
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" type="button" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button size="sm" type="submit" loading={loading}>
            {isEdit ? 'Sauvegarder' : "Ajouter l'employé"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
