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

/**
 * Issue d'une demande de suppression de compte. Ce sont des réponses
 * normales du serveur (pas des pannes), donc des valeurs plutôt que des
 * exceptions : la page choisit le message à afficher pour chacune.
 */
export type DeleteAccountResult =
  'deleted' | 'invalid-password' | 'forbidden' | 'rate-limited' | 'unauthorized';

/**
 * Supprime le compte connecté (`POST /api/auth/delete-user`, better-auth).
 *
 * Le serveur exige le mot de passe à chaque fois et refuse les comptes
 * administrateurs (`forbidden`). En cas de succès, il efface le compte et toutes
 * ses données (sessions, favoris, notes, révisions, quiz) puis retire le cookie
 * de session : rien d'autre à nettoyer côté navigateur.
 */
export async function deleteAccount(password: string): Promise<DeleteAccountResult> {
  const { error } = await authClient.deleteUser({ password });

  if (!error) {
    return 'deleted';
  }

  if (error.status === 400 && error.code === 'INVALID_PASSWORD') return 'invalid-password';
  if (error.status === 401) return 'unauthorized';
  if (error.status === 403) return 'forbidden';
  if (error.status === 429) return 'rate-limited';

  throw new Error('Impossible de supprimer le compte');
}

/**
 * Issue d'une demande ou d'une validation de réinitialisation de mot de passe.
 * Comme pour la suppression : des réponses normales, donc des valeurs.
 */
export type PasswordResetResult =
  'ok' | 'invalid-token' | 'password-too-short' | 'rate-limited' | 'unavailable';

function toResetResult(error: { status?: number; code?: string } | null): PasswordResetResult {
  if (!error) return 'ok';
  if (error.code === 'INVALID_TOKEN') return 'invalid-token';
  if (error.code === 'PASSWORD_TOO_SHORT') return 'password-too-short';
  if (error.status === 429) return 'rate-limited';
  if (error.status === 503) return 'unavailable';

  throw new Error('Une erreur est survenue');
}

/**
 * Demande l'envoi d'un lien de réinitialisation (`POST /api/auth/request-password-reset`).
 *
 * `'ok'` ne dit **pas** qu'un compte existe : le serveur répond pareil dans les
 * deux cas, pour ne pas révéler quelles adresses sont inscrites. La page doit
 * donc afficher un message neutre (« si un compte existe… »).
 *
 * `redirectTo` est la page où le lien du courriel ramène ; le serveur ne
 * l'accepte que si son origine figure dans `FRONTEND_ORIGIN`.
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  const { error } = await authClient.requestPasswordReset({
    email,
    redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
  });

  return toResetResult(error);
}

/** Choisit le nouveau mot de passe avec le jeton reçu par courriel (usage unique, 1 h). */
export async function resetPassword(
  newPassword: string,
  token: string,
): Promise<PasswordResetResult> {
  const { error } = await authClient.resetPassword({ newPassword, token });

  return toResetResult(error);
}

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
