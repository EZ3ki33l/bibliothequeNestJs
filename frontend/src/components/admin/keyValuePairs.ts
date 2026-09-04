/**
 * Passerelle entre la saisie du formulaire et le format attendu par l'API.
 *
 * En base, `files` et `dependencies` sont des objets (`{ "/App.tsx": "..." }`).
 * Dans un formulaire, il faut une **liste** : on ajoute, on supprime, on réordonne,
 * et deux lignes peuvent temporairement porter le même nom pendant la frappe —
 * ce qu'un objet ne permet pas de représenter.
 *
 * D'où l'`id` : c'est la clé React de la ligne. Utiliser l'index provoquerait le
 * bug classique de la suppression d'une ligne au milieu (React réutilise le DOM
 * de la ligne supprimée et le contenu semble « glisser » d'une case à l'autre).
 */
export type KeyValuePair = {
  /** Identité stable de la ligne, jamais envoyée au serveur. */
  id: string;
  key: string;
  value: string;
};

export function emptyPair(): KeyValuePair {
  return { id: crypto.randomUUID(), key: '', value: '' };
}

/** Objet venu de l'API → lignes du formulaire (édition d'une fiche existante). */
export function recordToPairs(record: Record<string, string> | undefined): KeyValuePair[] {
  if (record === undefined) {
    return [];
  }
  return Object.entries(record).map(([key, value]) => ({
    id: crypto.randomUUID(),
    key,
    value,
  }));
}

/**
 * Lignes du formulaire → objet à envoyer, ou message d'erreur.
 *
 * Deux règles, appliquées avant l'envoi pour donner une erreur lisible plutôt
 * qu'un 400 du serveur :
 * - une ligne avec du contenu mais sans nom est une erreur (le contenu serait
 *   perdu silencieusement) ;
 * - une ligne entièrement vide est simplement ignorée, car le formulaire en
 *   affiche une en permanence pour permettre l'ajout ;
 * - un nom en double est une erreur : dans un objet, la seconde valeur
 *   écraserait la première sans prévenir.
 *
 * Le retour est un résultat (`ok` / `message`) plutôt qu'une exception : l'appelant
 * affiche le message sous le champ, ce n'est pas une panne.
 */
export function pairsToRecord(
  pairs: KeyValuePair[],
  emptyKeyMessage = 'Chaque ligne renseignée doit avoir un nom.',
): { ok: true; value: Record<string, string> } | { ok: false; message: string } {
  const record: Record<string, string> = {};

  for (const pair of pairs) {
    const key = pair.key.trim();
    const hasContent = pair.value.trim().length > 0;
    if (key.length === 0) {
      if (hasContent) {
        return { ok: false, message: emptyKeyMessage };
      }
      continue;
    }
    if (key in record) {
      return { ok: false, message: `Le nom « ${key} » est en double.` };
    }
    record[key] = pair.value;
  }

  return { ok: true, value: record };
}
