'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  getActionInbox,
  refreshActionInbox,
  updateActionItemStatus,
} from '../api/action-inbox.api';
import type {
  ActionInboxFilters,
  UpdateActionItemStatusPayload,
} from '../types/action-inbox.types';
import { ACTION_INBOX_KEY } from '../../../lib/query-keys';

export function useActionInbox(filters: ActionInboxFilters) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ACTION_INBOX_KEY, filters],
    queryFn: async ({ signal }) => {
      // Les détecteurs tournent avant chaque lecture : la boîte reflète
      // toujours l'état réel des shifts et distributions (aucune donnée fictive).
      await refreshActionInbox();
      return getActionInbox(filters, signal);
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateActionItemStatusPayload }) =>
      updateActionItemStatus(id, payload),
    onSuccess: (_data, { payload }) => {
      queryClient.invalidateQueries({ queryKey: [ACTION_INBOX_KEY] });
      toast.success(
        payload.status === 'RESOLVED' ? 'Action marquée comme résolue.' : 'Action ignorée.',
      );
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
      toast.error("Impossible de mettre à jour l'action.", { description: message });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    updateStatus: (id: string, payload: UpdateActionItemStatusPayload) =>
      statusMutation.mutateAsync({ id, payload }),
    isUpdating: statusMutation.isPending,
  };
}
