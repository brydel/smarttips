'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';

import { createDispute, getMyDisputes, withdrawDispute } from '../api/disputes.api';
import type { CreateDisputePayload, EmployeeDispute } from '../types/dispute.types';
import { isActiveDisputeStatus } from '../utils/dispute-labels';
import { EMPLOYEE_DISPUTES_KEY } from '../../../lib/query-keys';

/** Hook employé : ses litiges, ouverture et retrait (BIS-56). */
export function useMyDisputes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [EMPLOYEE_DISPUTES_KEY],
    queryFn: ({ signal }) => getMyDisputes(signal),
    retry: 1,
    staleTime: 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateDisputePayload) => createDispute(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_DISPUTES_KEY] });
      toast.success('Votre question a été envoyée.', {
        description: 'Votre gestionnaire la prendra en charge.',
      });
    },
    onError: (error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 409) {
        toast.error('Une demande est déjà en cours pour ce shift.');
        return;
      }
      toast.error("Impossible d'envoyer votre question.", {
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => withdrawDispute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_DISPUTES_KEY] });
      toast.success('Votre demande a été retirée.');
    },
    onError: (error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 400) {
        toast.error('Cette demande est déjà prise en charge et ne peut plus être retirée.');
        return;
      }
      toast.error('Impossible de retirer la demande.', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
      });
    },
  });

  /** Litige actif par distribution : pour le badge et le blocage du formulaire. */
  const activeByDistributionId = new Map<string, EmployeeDispute>();
  for (const dispute of query.data ?? []) {
    if (isActiveDisputeStatus(dispute.status)) {
      activeByDistributionId.set(dispute.tipDistributionId, dispute);
    }
  }

  return {
    disputes: query.data ?? null,
    activeByDistributionId,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    create: (payload: CreateDisputePayload) => createMutation.mutateAsync(payload),
    isCreating: createMutation.isPending,
    withdraw: (id: string) => withdrawMutation.mutateAsync(id),
    isWithdrawing: withdrawMutation.isPending,
  };
}
