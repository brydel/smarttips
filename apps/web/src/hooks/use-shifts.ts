import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  addAssignment,
  closeShift,
  createShift,
  fetchShift,
  fetchShifts,
  removeAssignment,
  updateAssignment,
} from '../services/shifts.service';
import { ORDERS_KEY, SHIFT_KEY, SHIFTS_KEY, TIP_POOLS_KEY } from '../lib/query-keys';
import { extractErrorMessage } from '../lib/errors';
import type {
  CreateAssignmentPayload,
  CreateShiftPayload,
  Shift,
  ShiftFilters,
  UpdateAssignmentPayload,
} from '../types/shift';

// ── Queries ───────────────────────────────────────────────────────────────────

export function useShifts(filters: ShiftFilters = {}) {
  return useQuery<Shift[]>({
    queryKey: [SHIFTS_KEY, filters],
    queryFn: ({ signal }) => fetchShifts(filters, signal),
    staleTime: 30_000,
  });
}

export function useShift(id: string) {
  return useQuery<Shift>({
    queryKey: [SHIFT_KEY, id],
    queryFn: ({ signal }) => fetchShift(id, signal),
    staleTime: 15_000,
    enabled: Boolean(id),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateShift() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateShiftPayload) => createShift(payload),
    onSuccess: () => {
      toast.success('Shift créé avec succès');
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, 'Erreur lors de la création du shift'));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [SHIFTS_KEY] });
    },
  });
}

export function useCloseShift() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => closeShift(id),
    onSuccess: (updated) => {
      // Optimistically update detail + list cache
      qc.setQueryData<Shift>([SHIFT_KEY, updated.id], updated);
      qc.setQueriesData<Shift[]>({ queryKey: [SHIFTS_KEY] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((s) => (s.id === updated.id ? updated : s));
      });
      toast.success('Shift clôturé avec succès');
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, 'Erreur lors de la clôture du shift'));
    },
    onSettled: (_, __, id) => {
      void qc.invalidateQueries({ queryKey: [SHIFTS_KEY] });
      void qc.invalidateQueries({ queryKey: [SHIFT_KEY, id] });
      // Invalidate tip pools so a pre-existing pool is immediately visible after close (ROB-H5 / ARCH-H2).
      void qc.invalidateQueries({ queryKey: [TIP_POOLS_KEY] });
    },
  });
}

export function useAddAssignment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ shiftId, payload }: { shiftId: string; payload: CreateAssignmentPayload }) =>
      addAssignment(shiftId, payload),
    onSuccess: (updated) => {
      qc.setQueryData<Shift>([SHIFT_KEY, updated.id], updated);
      toast.success('Employé assigné au shift');
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Erreur lors de l'assignation"));
    },
    onSettled: (_, __, { shiftId }) => {
      void qc.invalidateQueries({ queryKey: [SHIFT_KEY, shiftId] });
    },
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      shiftId,
      employeeId,
      payload,
    }: {
      shiftId: string;
      employeeId: string;
      payload: UpdateAssignmentPayload;
    }) => updateAssignment(shiftId, employeeId, payload),
    onMutate: async ({ shiftId, employeeId, payload }) => {
      await qc.cancelQueries({ queryKey: [SHIFT_KEY, shiftId] });
      const previous = qc.getQueryData<Shift>([SHIFT_KEY, shiftId]);
      qc.setQueryData<Shift>([SHIFT_KEY, shiftId], (old) => {
        if (!old) return old;
        return {
          ...old,
          assignments: old.assignments.map((a) =>
            a.employeeId === employeeId ? { ...a, ...payload } : a,
          ),
        };
      });
      return { previous };
    },
    onSuccess: (updated) => {
      qc.setQueryData<Shift>([SHIFT_KEY, updated.id], updated);
    },
    onError: (err: unknown, { shiftId }, ctx) => {
      if (ctx?.previous) qc.setQueryData([SHIFT_KEY, shiftId], ctx.previous);
      toast.error(extractErrorMessage(err, 'Erreur lors de la mise à jour'));
    },
    onSettled: (_, __, { shiftId }) => {
      void qc.invalidateQueries({ queryKey: [SHIFT_KEY, shiftId] });
    },
  });
}

export function useRemoveAssignment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ shiftId, employeeId }: { shiftId: string; employeeId: string }) =>
      removeAssignment(shiftId, employeeId),
    onMutate: async ({ shiftId, employeeId }) => {
      await qc.cancelQueries({ queryKey: [SHIFT_KEY, shiftId] });
      const previous = qc.getQueryData<Shift>([SHIFT_KEY, shiftId]);
      qc.setQueryData<Shift>([SHIFT_KEY, shiftId], (old) => {
        if (!old) return old;
        return {
          ...old,
          assignments: old.assignments.filter((a) => a.employeeId !== employeeId),
        };
      });
      return { previous };
    },
    onSuccess: (_, { shiftId }) => {
      toast.success('Employé retiré du shift');
      // Only invalidate related data on confirmed server success, not after a failed remove
      void qc.invalidateQueries({ queryKey: [ORDERS_KEY] });
      void qc.invalidateQueries({ queryKey: [TIP_POOLS_KEY] });
      void qc.invalidateQueries({ queryKey: [SHIFTS_KEY] });
    },
    onError: (err: unknown, { shiftId }, ctx) => {
      if (ctx?.previous) qc.setQueryData([SHIFT_KEY, shiftId], ctx.previous);
      toast.error(extractErrorMessage(err, 'Erreur lors du retrait'));
    },
    onSettled: (_, __, { shiftId }) => {
      // Always re-sync the shift detail regardless of success/failure
      void qc.invalidateQueries({ queryKey: [SHIFT_KEY, shiftId] });
    },
  });
}
