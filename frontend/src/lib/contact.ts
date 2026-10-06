import { apiFetch } from './api';

/**
 * Appel du formulaire de contact.
 *
 * Route publique : pas de session, donc pas de résultat « unauthorized » comme
 * dans les autres fichiers de `lib/`. Le destinataire n'apparaît nulle part
 * côté navigateur : le serveur le lit dans sa configuration.
 */

export type ContactInput = {
  name: string;
  email: string;
  message: string;
  /** Champ piège : toujours vide pour un humain (voir `ContactPage`). */
  alias: string;
};

export type ContactResult = 'sent' | 'invalid' | 'rate_limited' | 'unavailable';

export async function sendContactMessage(input: ContactInput): Promise<ContactResult> {
  const response = await apiFetch('/contact', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (response.status === 204) return 'sent';
  if (response.status === 400) return 'invalid';
  if (response.status === 429) return 'rate_limited';

  // 503 (envoi indisponible) ou toute autre réponse inattendue : dans les deux
  // cas, le message n'est pas parti.
  return 'unavailable';
}
