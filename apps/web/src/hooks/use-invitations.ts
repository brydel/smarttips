import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  type InvitationCreatePayload,
} from '../services/invitations.service';
import { extractErrorMessage } from '../lib/errors';
import { INVITATIONS_KEY, EMPLOYEES_KEY } from '../lib/query-keys';

// ── Lister les invitations ────────────────────────────────────────────────────

export function useInvitations() {
  return useQuery({
    queryKey: [INVITATIONS_KEY],
    queryFn: listInvitations,
    // Pas de gcTime=0 car pas de PII critique (emails visibles côté manager)
    staleTime: 30_000,
  });
}

// ── Créer une invitation ──────────────────────────────────────────────────────

export function useCreateInvitation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: InvitationCreatePayload) => createInvitation(payload),
    onSuccess: () => {
      // Invalider la liste des invitations pour afficher la nouvelle invitation
      void qc.invalidateQueries({ queryKey: [INVITATIONS_KEY] });
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Erreur lors de l'envoi de l'invitation"));
    },
  });
}

// ── Révoquer une invitation ───────────────────────────────────────────────────

export function useRevokeInvitation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      toast.success('Invitation révoquée');
      void qc.invalidateQueries({ queryKey: [INVITATIONS_KEY] });
      // Invalider aussi les employés car un employé pourrait redevenir invitable
      void qc.invalidateQueries({ queryKey: [EMPLOYEES_KEY] });
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, 'Erreur lors de la révocation'));
    },
  });
}
