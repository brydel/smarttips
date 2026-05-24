import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  updateEmployee,
} from '../services/employees.service';
import { extractErrorMessage } from '../lib/errors';
import type {
  CreateEmployeePayload,
  Employee,
  EmployeeFilters,
  UpdateEmployeePayload,
} from '../types/employee';

export const EMPLOYEES_KEY = 'employees';

export function useEmployees(filters: EmployeeFilters = {}) {
  return useQuery({
    queryKey: [EMPLOYEES_KEY, filters],
    queryFn: ({ signal }) => fetchEmployees(filters, signal),
    // SEC-M5: set gcTime to 0 so employee PII is not kept in memory after the
    // subscribing component unmounts (especially important for 10M-user scale).
    gcTime: 0,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployee(payload),
    onSuccess: () => {
      toast.success('Employé ajouté avec succès');
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Erreur lors de l'ajout de l'employé"));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY] });
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEmployeePayload }) =>
      updateEmployee(id, payload),
    onMutate: async ({ id, payload }) => {
      // ROB-C3: capture snapshot BEFORE cancelling queries — cancelQueries can
      // trigger query state changes that would corrupt a snapshot taken after.
      const previous = qc.getQueriesData<Employee[]>({ queryKey: [EMPLOYEES_KEY] });
      await qc.cancelQueries({ queryKey: [EMPLOYEES_KEY] });
      qc.setQueriesData<Employee[]>({ queryKey: [EMPLOYEES_KEY] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((e) => (e.id === id ? { ...e, ...payload } : e));
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success('Employé mis à jour');
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
      void qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onMutate: async (id) => {
      // ROB-C3: capture snapshot BEFORE cancelling queries (same as useUpdateEmployee above).
      const previous = qc.getQueriesData<Employee[]>({ queryKey: [EMPLOYEES_KEY] });
      await qc.cancelQueries({ queryKey: [EMPLOYEES_KEY] });
      qc.setQueriesData<Employee[]>({ queryKey: [EMPLOYEES_KEY] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((e) => e.id !== id);
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success('Employé supprimé');
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
      void qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY] });
    },
  });
}
