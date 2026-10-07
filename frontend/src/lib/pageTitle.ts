import { useEffect } from 'react';

export const SITE_NAME = 'Bibliothèque';

/** Titre d'onglet d'une page : « <nom> · Bibliothèque », ou le nom du site seul. */
export function pageTitle(name?: string): string {
  const trimmed = name?.trim();

  return trimmed ? `${trimmed} · ${SITE_NAME}` : SITE_NAME;
}

/**
 * Donne son titre à l'onglet du navigateur tant que le composant est affiché.
 *
 * `document.title` est écrit directement plutôt que par une balise `<title>`
 * rendue par React : `index.html` en contient déjà une, et le navigateur lit la
 * première.
 *
 * Sans `name`, le titre est neutre. C'est ce que passe une page dont la donnée
 * n'est pas chargée ou est introuvable : l'onglet ne peut alors pas révéler le
 * nom d'un contenu non publié. Le nettoyage remet aussi le titre neutre quand
 * le composant disparaît, pour qu'une page sans titre n'hérite jamais de celui
 * de la page précédente.
 *
 * Le nom est du texte : `document.title` n'interprète aucun balisage.
 */
export function usePageTitle(name?: string): void {
  useEffect(() => {
    document.title = pageTitle(name);

    return () => {
      document.title = SITE_NAME;
    };
  }, [name]);
}
