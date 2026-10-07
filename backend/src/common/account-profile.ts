/**
 * Règles du profil d'un compte : nom affiché, champs modifiables, changement de
 * mot de passe.
 *
 * better-auth expose déjà `update-user`, `sign-up/email` et `change-password`,
 * et vérifie lui-même la session, le mot de passe actuel et la longueur du
 * nouveau. Ce fichier ajoute ce qu'il laisse au bon vouloir du client : un
 * formulaire honnête envoie ce qu'il faut, une requête forgée (`curl`) non.
 *
 * Volontairement pures (aucune dépendance à better-auth ni à Prisma) : elles
 * décident, `auth.ts` les branche sur le hook `before` et traduit le refus en
 * erreur HTTP. Même découpage que `account-deletion.ts`.
 */

export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 80;

/** Seuls champs qu'un titulaire peut modifier par `update-user`. */
const UPDATABLE_PROFILE_FIELDS: readonly string[] = ['name'];

/** Motif de refus, à traduire en réponse HTTP par l'appelant. `null` = autorisé. */
export type ProfileUpdateRefusal = 'UNKNOWN_FIELD' | 'INVALID_NAME';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Vrai si `name` peut servir de nom affiché : du texte, de 2 à 80 caractères
 * une fois les espaces de bord retirés.
 *
 * La longueur **brute** est bornée elle aussi : sans cela, deux lettres suivies
 * de dix mille espaces passeraient la règle et seraient enregistrées telles
 * quelles.
 *
 * Le nom reste du texte : aucun balisage n'est retiré ici, parce que React
 * l'affiche comme du texte (`<b>` s'affiche `<b>`). Échapper deux fois
 * abîmerait un nom légitime.
 */
export function isValidDisplayName(name: unknown): boolean {
  if (typeof name !== 'string') {
    return false;
  }

  return name.length <= MAX_DISPLAY_NAME_LENGTH && name.trim().length >= MIN_DISPLAY_NAME_LENGTH;
}

/**
 * Contrôle le corps de `update-user`.
 *
 * Liste **blanche** : seul `name` est accepté. better-auth accepterait aussi
 * `image` (une adresse quelconque, affichable plus tard) : la refuser ici évite
 * de découvrir le champ le jour où une page l'affiche. Un champ inconnu est un
 * refus, pas un champ ignoré : le client sait qu'il n'a pas été pris en compte.
 */
export function profileUpdateRefusal(body: unknown): ProfileUpdateRefusal | null {
  if (!isRecord(body)) {
    return 'INVALID_NAME';
  }

  if (Object.keys(body).some((field) => !UPDATABLE_PROFILE_FIELDS.includes(field))) {
    return 'UNKNOWN_FIELD';
  }

  return isValidDisplayName(body.name) ? null : 'INVALID_NAME';
}

/**
 * Vrai si le corps de `change-password` demande bien la fermeture des autres
 * sessions (`revokeOtherSessions: true`).
 *
 * better-auth laisse ce champ facultatif. Or un mot de passe se change souvent
 * parce que le compte est peut-être compromis : garder les autres sessions
 * ouvertes laisserait l'intrus connecté. Le formulaire l'envoie toujours ; le
 * serveur l'exige, pour qu'une requête forgée ne puisse pas l'omettre. Seul le
 * booléen `true` compte : ni `"true"`, ni `1`.
 */
export function mustRevokeOtherSessions(body: unknown): boolean {
  return isRecord(body) && body.revokeOtherSessions === true;
}
