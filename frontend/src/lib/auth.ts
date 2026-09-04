import { createAuthClient } from 'better-auth/react';
import { apiFetch, apiUrl } from './api';

/**
 * Client better-auth du navigateur : inscription, connexion, déconnexion et
 * `useSession()` pour l'affichage.
 *
 * `useSession()` sert **uniquement** à l'interface (afficher un avatar, montrer
 * ou cacher un lien). Il ne protège rien : c'est un état du navigateur, donc
 * modifiable. Toute décision d'accès passe par le serveur — `GET /me` ou
 * `GET /admin/me`.
 *
 * La version du paquet doit rester alignée avec celle du backend : le format
 * des cookies de session change entre versions majeures.
 */
export const authClient = createAuthClient({
  baseURL: apiUrl,
});

/** Réponse de la vérification de session : connecté, ou pas. */
export type MeResult = 'ok' | 'unauthorized';

/**
 * Demande au serveur si la session est valide (`GET /me`, protégé par
 * `SessionGuard`).
 *
 * C'est la garde des pages qui exigent d'être connecté : on ne fait confiance
 * qu'au serveur, seul capable de vérifier la signature du cookie. Un 401 n'est
 * pas une panne mais une réponse normale — d'où la valeur `'unauthorized'`
 * plutôt qu'une exception ; la page redirige alors vers `/login`.
 */
export async function getMe(): Promise<MeResult> {
  const response = await apiFetch('/me');

  if (response.status === 401) {
    return 'unauthorized';
  }

  if (!response.ok) {
    throw new Error('Impossible de vérifier la session');
  }

  return 'ok';
}
