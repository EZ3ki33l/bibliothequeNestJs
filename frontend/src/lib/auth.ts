import { createAuthClient } from 'better-auth/react';
import { apiFetch, apiUrl } from './api';
import { safeReturnTo } from './returnTo';

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
 * ses données (sessions, favoris, notes, fiches lues, quiz) puis retire le cookie
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

/** Issue d'un changement de nom affiché. */
export type UpdateNameResult = 'ok' | 'invalid-name' | 'rate-limited' | 'unauthorized';

/**
 * Change le nom affiché (`POST /api/auth/update-user`, better-auth).
 *
 * Le serveur n'accepte que `name`, de 2 à 80 caractères : la règle du
 * formulaire n'est qu'une aide, c'est son refus (400) qui fait foi. En cas de
 * succès, `useSession()` se met à jour tout seul : le menu affiche le nouveau
 * nom sans rechargement.
 */
export async function updateName(name: string): Promise<UpdateNameResult> {
  const { error } = await authClient.updateUser({ name });

  if (!error) return 'ok';
  if (error.status === 400) return 'invalid-name';
  if (error.status === 401) return 'unauthorized';
  if (error.status === 429) return 'rate-limited';

  throw new Error('Impossible d’enregistrer le nom');
}

/** Issue d'un changement de mot de passe. */
export type ChangePasswordResult =
  'ok' | 'invalid-password' | 'password-too-short' | 'rate-limited' | 'unauthorized';

/**
 * Change le mot de passe (`POST /api/auth/change-password`, better-auth).
 *
 * Le serveur vérifie le mot de passe actuel : sans lui, une session volée ne
 * peut pas s'approprier le compte. `revokeOtherSessions: true` est toujours
 * envoyé, et **exigé** par le serveur : les autres sessions sont fermées, celle
 * en cours reste ouverte.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const { error } = await authClient.changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  });

  if (!error) return 'ok';
  if (error.code === 'INVALID_PASSWORD') return 'invalid-password';
  if (error.code === 'PASSWORD_TOO_SHORT') return 'password-too-short';
  if (error.status === 401) return 'unauthorized';
  if (error.status === 429) return 'rate-limited';

  throw new Error('Impossible de changer le mot de passe');
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

/**
 * Issue d'une demande de message de vérification. Des réponses normales du
 * serveur, donc des valeurs : l'écran choisit quoi dire pour chacune.
 */
export type VerificationRequestResult =
  'sent' | 'already-verified' | 'rate-limited' | 'unavailable' | 'unauthorized';

/** Durée de validité du lien, telle que l'annonce le message (réglée côté serveur). */
export const VERIFICATION_LINK_VALIDITY = 'une heure';

/**
 * Demande l'envoi du message de vérification à l'adresse du compte connecté
 * (`POST /api/auth/send-verification-email`, better-auth).
 *
 * `email` est l'adresse de la session : le serveur refuse toute autre valeur,
 * et refuse la demande sans session. Le paramètre n'existe que parce que la
 * route de better-auth l'exige.
 *
 * `callbackURL` est la page où le lien du message ramène (`/adresse-verifiee`),
 * avec la destination à rejoindre ensuite. Le serveur n'accepte que l'origine
 * du site ; `returnTo` passe par `safeReturnTo` ici, puis **de nouveau** à
 * l'arrivée, au moment de naviguer.
 *
 * Ne lève jamais : une panne réseau vaut `'unavailable'`, pour que l'écran dise
 * que le message n'est pas parti et propose de réessayer.
 */
export async function sendVerificationEmail(
  email: string,
  returnTo: string,
): Promise<VerificationRequestResult> {
  const callbackURL = `${window.location.origin}/adresse-verifiee?retour=${encodeURIComponent(
    safeReturnTo(returnTo),
  )}`;

  try {
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL });

    if (!error) return 'sent';
    if (error.code === 'EMAIL_ALREADY_VERIFIED') return 'already-verified';
    if (error.status === 401) return 'unauthorized';
    if (error.status === 429) return 'rate-limited';

    return 'unavailable';
  } catch {
    return 'unavailable';
  }
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
