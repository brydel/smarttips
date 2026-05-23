import { AxiosError } from 'axios';

/**
 * Extracts a user-friendly error message from an unknown thrown value.
 * Handles Axios API errors, network errors, and generic Error instances.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    // Network-level error (no response)
    if (!err.response) {
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        return 'Délai de connexion dépassé. Réessayez.';
      }
      return 'Connexion au serveur impossible. Vérifiez votre réseau.';
    }
    // API error with message body
    const msg = err.response.data?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
    // HTTP status fallback
    if (err.response.status === 403) return "Vous n'avez pas les droits pour cette action.";
    if (err.response.status === 404) return 'Ressource introuvable.';
    if (err.response.status >= 500) return 'Erreur serveur. Réessayez dans quelques instants.';
  }
  return fallback;
}
