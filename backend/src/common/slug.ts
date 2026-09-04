/**
 * Transforme un nom lisible en identifiant d'URL : « Étiquette Réact » →
 * `etiquette-react`.
 *
 * Toujours calculé par le serveur, jamais reçu du client : c'est ce qui garantit
 * qu'une URL publique ne contient ni espace, ni accent, ni caractère à
 * échapper.
 *
 * Les étapes, dans l'ordre (il compte) :
 * 1. `normalize('NFD')` sépare une lettre accentuée en lettre + accent (`é` →
 *    `e` + ´), ce qui permet de retirer l'accent à l'étape suivante ;
 * 2. `\p{M}` supprime ces marques diacritiques laissées seules ;
 * 3. minuscules, puis espaces de début/fin retirés ;
 * 4. toute suite de caractères non alphanumériques devient un seul tiret ;
 * 5. les tirets de début et de fin sont supprimés.
 */
export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
