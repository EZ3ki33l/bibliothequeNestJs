import { useLocation, useNavigate } from 'react-router';

/**
 * Retour vers la liste après l'enregistrement d'un formulaire d'administration.
 *
 * Revenir d'un cran dans l'historique ramène à l'écran d'où vient
 * l'administrateur, **avec son URL** : la liste retrouve donc ses filtres et sa
 * page, ce qu'une redirection vers `/admin/entries` effacerait.
 *
 * `location.key` vaut `'default'` quand l'écran est le premier de l'onglet
 * (lien ouvert dans un nouvel onglet, adresse saisie) : il n'y a alors rien
 * derrière, et reculer ferait quitter l'application. Dans ce cas seulement, la
 * redirection va vers `fallback`.
 */
export function useReturnToList(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key === 'default') {
      navigate(fallback);
    } else {
      navigate(-1);
    }
  };
}
