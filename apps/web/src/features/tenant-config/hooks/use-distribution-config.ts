'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getDistributionConfig, updateDistributionConfig } from '../api/tenant-config.api';
import type { UpdateDistributionConfigPayload } from '../types/tenant-config.types';
import { DISTRIBUTION_CONFIG_KEY } from '../../../lib/query-keys';

export function useDistributionConfig() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [DISTRIBUTION_CONFIG_KEY],
    queryFn: getDistributionConfig,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 2,
  });

  const mutation = useMutation({
    mutationFn: updateDistributionConfig,
    onSuccess: (data) => {
      // Update cache directly — no need to refetch
      queryClient.setQueryData([DISTRIBUTION_CONFIG_KEY], data);
      toast.success('Configuration sauvegardée avec succès.', {
        description: 'Les prochains shifts utiliseront ces nouveaux paramètres.',
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
      toast.error('Impossible de sauvegarder la configuration.', {
        description: message,
      });
    },
  });

  const save = (payload: UpdateDistributionConfigPayload) => mutation.mutateAsync(payload);

  return {
    config: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    save,
    isSaving: mutation.isPending,
  };
}
