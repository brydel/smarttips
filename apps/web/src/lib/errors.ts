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
    // API error with message body — sanitise before display (SEC-C2).
    // Reject messages that look like internal stack traces or framework internals.
    const raw = err.response.data?.message;
    const msg = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : null;
    if (
      typeof msg === 'string' &&
      msg.length > 0 &&
      msg.length < 300 &&
      !/stack\s+trace|at\s+\w+\.ts|TypeError:|prisma\.|\.spec\.|node_modules/i.test(msg)
    )
      return msg;
    // HTTP status fallback
    if (err.response.status === 403) return "Vous n'avez pas les droits pour cette action.";
    if (err.response.status === 404) return 'Ressource introuvable.';
    if (err.response.status >= 500) return 'Erreur serveur. Réessayez dans quelques instants.';
  }
  return fallback;
}
