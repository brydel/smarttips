import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createTipPool, fetchTipPoolByShift } from '../services/tip-pools.service';
import { SHIFT_KEY, SHIFTS_KEY, TIP_POOLS_KEY } from '../lib/query-keys';
import { extractErrorMessage } from '../lib/errors';
import type { CreateTipPoolPayload, TipPool } from '../types/tip-pool';

// ── Queries ───────────────────────────────────────────────────────────────────

export function useTipPool(shiftId: string, options?: { enabled?: boolean }) {
  return useQuery<TipPool>({
    queryKey: [TIP_POOLS_KEY, shiftId],
    queryFn: ({ signal }) => fetchTipPoolByShift(shiftId, signal),
    staleTime: 60_000,
    enabled: Boolean(shiftId) && (options?.enabled ?? true),
    retry: (count, err) => {
      // Don't retry on 404 — pool simply doesn't exist yet.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return count < 2;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateTipPool() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTipPoolPayload) => createTipPool(payload),
    onSuccess: (pool) => {
      toast.success('Pool de pourboires déclaré');
      qc.setQueryData<TipPool>([TIP_POOLS_KEY, pool.shiftId], pool);
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error('Un pool existe déjà pour ce shift.');
      } else {
        toast.error(extractErrorMessage(err, 'Erreur lors de la déclaration du pool'));
      }
    },
    onSettled: (_, __, payload) => {
      void qc.invalidateQueries({ queryKey: [TIP_POOLS_KEY, payload.shiftId] });
      void qc.invalidateQueries({ queryKey: [SHIFTS_KEY] });
      void qc.invalidateQueries({ queryKey: [SHIFT_KEY, payload.shiftId] });
    },
  });
}
