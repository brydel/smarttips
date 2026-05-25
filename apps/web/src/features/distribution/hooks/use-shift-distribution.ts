'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getShiftDistribution, distributeShift } from '../api/distribution.api';
import { SHIFT_DISTRIBUTION_KEY } from '../../../lib/query-keys';
import { isAxiosError } from 'axios';

/** Returns the distribution list for a given shift. */
export function useShiftDistribution(shiftId: string) {
  return useQuery({
    queryKey: [SHIFT_DISTRIBUTION_KEY, shiftId],
    queryFn: ({ signal }) => getShiftDistribution(shiftId, signal),
    enabled: !!shiftId,
    retry: (failureCount, error) => {
      // Don't retry on 404 (not distributed yet) or 403 (forbidden)
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404 || status === 403) return false;
      }
      return failureCount < 2;
    },
    staleTime: 30_000, // 30s — distribution data changes infrequently
  });
}

/** Triggers the distribution calculation for a shift. */
export function useDistributeShift(shiftId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => distributeShift(shiftId),
    onSuccess: () => {
      toast.success('Distribution calculée', {
        description: 'Les montants ont été calculés. Vérifiez et approuvez la répartition.',
      });
      void queryClient.invalidateQueries({ queryKey: [SHIFT_DISTRIBUTION_KEY, shiftId] });
    },
    onError: (error: unknown) => {
      let message = 'Impossible de calculer la distribution.';
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 400) {
          const msg = error.response?.data?.message as string | undefined;
          if (msg?.includes('shiftNotClosed')) {
            message = 'Le shift doit être clôturé avant de lancer la distribution.';
          } else if (msg?.includes('alreadyExists')) {
            message = 'La distribution a déjà été calculée pour ce shift.';
          } else if (msg?.includes('noTipPool')) {
            message = 'Aucun tip pool déclaré pour ce shift.';
          } else if (msg?.includes('noAssignments')) {
            message = 'Aucun employé assigné à ce shift.';
          }
        } else if (status === 409) {
          message = 'Une distribution est déjà en cours ou a déjà été créée.';
        }
      }
      toast.error('Échec du calcul', { description: message });
    },
  });
}
