import { useSearchParams } from 'react-router';

/**
 * Numéro de page d'une liste, tenu dans l'URL (`?page=3`).
 *
 * Dans un état React, la page serait perdue en quittant l'écran : après la
 * modification d'un élément de la page 3, la liste rouvrirait en page 1. Dans
 * l'URL, elle survit au bouton « retour » et au rechargement.
 *
 * La page 1 n'est pas écrite (`/admin/entries` plutôt que `?page=1`), et une
 * valeur illisible vaut 1. Les autres paramètres de l'URL (les filtres) sont
 * conservés.
 */
export function useUrlPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Math.floor(Number(searchParams.get('page'))) || 1);

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  }

  return { page, setPage };
}
