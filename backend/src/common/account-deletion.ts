/**
 * Règles de la suppression de compte en libre-service.
 *
 * Volontairement pures (aucune dépendance à better-auth ni à Prisma) : elles
 * décident, `auth.ts` les branche sur les points d'extension de better-auth et
 * traduit le refus en erreur HTTP. Séparées ainsi, elles se testent sans base
 * ni serveur.
 */

/** Motif de refus, à traduire en réponse HTTP par l'appelant. `null` = autorisé. */
export type DeletionRefusal = 'PASSWORD_REQUIRED' | 'ADMIN_ACCOUNT';

/**
 * Le mot de passe est exigé **à chaque suppression**.
 *
 * Sans lui, better-auth se rabat sur la « fraîcheur » de la session (moins d'un
 * jour) : un cookie volé, ou un poste laissé ouvert, suffirait à détruire le
 * compte. Redemander le mot de passe prouve que la personne le connaît encore.
 */
export function isPasswordProvided(password: unknown): boolean {
  return typeof password === 'string' && password.length > 0;
}

/**
 * Un compte administrateur ne se supprime pas en libre-service : la cascade
 * effacerait aussi la ligne `Admin`, et le site se retrouverait sans personne
 * pour publier des fiches. Le retrait des droits est un geste volontaire, fait
 * en base.
 */
export function deletionRefusal(isAdmin: boolean): DeletionRefusal | null {
  return isAdmin ? 'ADMIN_ACCOUNT' : null;
}
