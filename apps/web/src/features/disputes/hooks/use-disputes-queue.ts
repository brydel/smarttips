'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getDisputeQueue, resolveDispute, startDisputeReview } from '../api/disputes.api';
import type { DisputeQueueFilters, ResolveDisputePayload } from '../types/dispute.types';
import { ACTION_INBOX_KEY, DISPUTES_QUEUE_KEY } from '../../../lib/query-keys';

/** Hook manager : file des litiges, prise en charge et résolution (BIS-56). */
export function useDisputesQueue(filters: DisputeQueueFilters) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [DISPUTES_QUEUE_KEY, filters],
    queryFn: ({ signal }) => getDisputeQueue(filters, signal),
    retry: 1,
    staleTime: 30 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [DISPUTES_QUEUE_KEY] });
    // L'item DISPUTE_OPEN de la boîte d'actions s'auto-résout au refresh.
    queryClient.invalidateQueries({ queryKey: [ACTION_INBOX_KEY] });
  };

  const reviewMutation = useMutation({
    mutationFn: (id: string) => startDisputeReview(id),
    onSuccess: () => {
      invalidate();
      toast.success('Litige pris en charge.');
    },
    onError: (error: unknown) => {
      toast.error('Impossible de prendre en charge le litige.', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ResolveDisputePayload }) =>
      resolveDispute(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success('Litige résolu.', {
        description: 'La réponse est visible par l’employé. Aucun montant n’a été modifié.',
      });
    },
    onError: (error: unknown) => {
      toast.error('Impossible de résoudre le litige.', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
      });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    startReview: (id: string) => reviewMutation.mutateAsync(id),
    isReviewing: reviewMutation.isPending,
    resolve: (id: string, payload: ResolveDisputePayload) =>
      resolveMutation.mutateAsync({ id, payload }),
    isResolving: resolveMutation.isPending,
  };
}
