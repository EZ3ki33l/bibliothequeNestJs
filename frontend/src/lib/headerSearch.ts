/**
 * Règles du champ de recherche de l'en-tête (`AppHeader`).
 *
 * Le champ ne cherche rien lui-même : il mène à `/recherche`, qui reste le seul
 * écran à interroger l'API. Les critères vivent dans l'URL, comme sur cette
 * page ; ces fonctions ne font que la composer et la relire.
 */

/** Longueur maximale des mots cherchés : la même dans l'en-tête et sur `/recherche`. */
export const MAX_SEARCH_LENGTH = 100;

const SEARCH_PATH = '/recherche';

/**
 * Adresse ouverte par une saisie dans l'en-tête.
 *
 * Depuis `/recherche`, les filtres déjà posés (format, niveau, leçon,
 * étiquette) sont conservés : seuls les mots changent. Depuis une autre page,
 * la recherche part sans filtre. Dans les deux cas elle revient à la première
 * page de résultats. Une saisie vide ouvre la page de recherche sans mot.
 */
export function headerSearchHref(pathname: string, search: string, rawQuery: string): string {
  const q = rawQuery.trim().slice(0, MAX_SEARCH_LENGTH);
  const params = new URLSearchParams(pathname === SEARCH_PATH ? search : '');

  params.delete('page');
  if (q) params.set('q', q);
  else params.delete('q');

  const query = params.toString();
  return query ? `${SEARCH_PATH}?${query}` : SEARCH_PATH;
}

/** Mots à afficher dans le champ : ceux de l'URL sur `/recherche`, rien ailleurs. */
export function headerSearchValue(pathname: string, search: string): string {
  if (pathname !== SEARCH_PATH) return '';
  return new URLSearchParams(search).get('q')?.trim() ?? '';
}
