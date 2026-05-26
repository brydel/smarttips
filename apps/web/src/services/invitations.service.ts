/**
 * Service API pour les invitations employés (BIS-43).
 *
 * Sécurité :
 * - Jamais de tokenHash exposé côté frontend
 * - Jamais de tenantId/employeeId envoyés par le client sur accept
 * - Le token brut n'est jamais loggé ni stocké
 */
import { apiClient } from '../lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvitationCreatePayload {
  employeeId: string;
  email: string;
}

export interface InvitationCreateResponse {
  id: string;
  email: string;
  expiresAt: string;
  /** URL complète du magic link. Contient le token brut pour QR code. */
  inviteUrl: string;
}

export interface InvitationListItem {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    active: boolean;
  };
  inviter: {
    id: string;
    name: string;
  };
}

export interface InvitationValidationResponse {
  valid: true;
  email: string;
  expiresAt: string;
  employee: {
    firstName: string;
    lastName: string;
    role: string;
  };
  tenant: {
    name: string;
  };
}

/** SEC-BIS43: seuls firstName, lastName et password sont envoyés — jamais tenantId/employeeId/role */
export interface InvitationAcceptPayload {
  firstName: string;
  lastName: string;
  password: string;
}

export interface InvitationAcceptResponse {
  accessToken: string;
  user: {
    id: string;
    tenantId: string;
    email: string;
    role: 'EMPLOYEE';
    name: string;
  };
}

// ── Fonctions API ─────────────────────────────────────────────────────────────

/** POST /invitations — crée une invitation et envoie l'email. OWNER/MANAGER uniquement. */
export async function createInvitation(
  payload: InvitationCreatePayload,
): Promise<InvitationCreateResponse> {
  const { data } = await apiClient.post<InvitationCreateResponse>('/invitations', payload);
  return data;
}

/** GET /invitations — liste les invitations du tenant. OWNER/MANAGER uniquement. */
export async function listInvitations(): Promise<InvitationListItem[]> {
  const { data } = await apiClient.get<InvitationListItem[]>('/invitations');
  return data;
}

/**
 * GET /invitations/:token/validate — route publique.
 * Valide le token sans connexion. Utilisée par la page /invite.
 * SEC: pas d'Authorization header sur cette route (apiClient en enverra un si disponible, ce qui est inoffensif).
 */
export async function validateInvitation(token: string): Promise<InvitationValidationResponse> {
  const { data } = await apiClient.get<InvitationValidationResponse>(
    `/invitations/${encodeURIComponent(token)}/validate`,
  );
  return data;
}

/**
 * POST /invitations/:token/accept — route publique.
 * Accepte l'invitation et crée le compte employé.
 * SEC: seuls firstName/lastName/password sont envoyés — jamais tenantId/employeeId/role.
 */
export async function acceptInvitation(
  token: string,
  payload: InvitationAcceptPayload,
): Promise<InvitationAcceptResponse> {
  const { data } = await apiClient.post<InvitationAcceptResponse>(
    `/invitations/${encodeURIComponent(token)}/accept`,
    payload,
  );
  return data;
}

/** DELETE /invitations/:id — révoque une invitation. OWNER uniquement. */
export async function revokeInvitation(id: string): Promise<void> {
  await apiClient.delete(`/invitations/${id}`);
}
