import { useCallback, useEffect, useState, type DependencyList } from 'react';

type AsyncData<T> = {
  /**
   * `undefined` pendant le chargement, sinon la valeur renvoyée par `load`.
   *
   * Les fonctions de `lib/` renvoient `null` pour « ressource introuvable »
   * (404), d'où trois états distincts et faciles à afficher :
   * `undefined` → squelette, `null` → « introuvable », valeur → contenu.
   */
  data: T | undefined;
  /** Message prêt à afficher, ou `null` si tout va bien. */
  error: string | null;
  /** Relance le chargement (après une suppression, par exemple). */
  reload: () => void;
  /**
   * Remplace la donnée sans repasser par le réseau.
   *
   * Utile quand une écriture renvoie déjà l'état suivant : `POST /reviews/:id/rate`
   * répond avec la carte à réviser d'après, inutile de la redemander.
   */
  setData: (data: T) => void;
};

type State<T> = {
  /** Signature des `deps` qui ont produit cette donnée (voir plus bas). */
  key: string;
  data: T | undefined;
  error: string | null;
};

/**
 * Charge une donnée asynchrone dans un composant.
 *
 * Ce hook remplace le bloc qui était recopié dans une douzaine de pages :
 * `useState` × 2, `useEffect`, `.then`, `.catch`, et le drapeau `cancelled`.
 *
 * Pourquoi ce drapeau est indispensable : entre le moment où la requête part et
 * celui où elle répond, l'utilisateur peut avoir quitté la page. Appeler
 * `setState` sur un composant démonté est au mieux inutile, au pire une fuite —
 * et deux requêtes lancées à la suite peuvent revenir dans le désordre, la plus
 * lente écrasant la plus récente. La fonction de nettoyage renvoyée par
 * `useEffect` (appelée au démontage et avant chaque nouvelle exécution) lève le
 * drapeau, et le résultat périmé est ignoré.
 *
 * @param load fonction qui lance la requête ; rejouée quand `deps` change
 * @param deps dépendances, comme pour `useEffect` (ex. `[slug]`)
 * @param errorMessage message affiché si la requête échoue — on ne montre jamais
 *        l'erreur technique brute à l'utilisateur
 */
export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: DependencyList,
  errorMessage: string,
): AsyncData<T> {
  /**
   * Les `deps` sont résumées en une chaîne (ce sont toujours des valeurs
   * simples : un slug, un id, un numéro de page).
   *
   * Deux avantages : l'effet ne dépend que de `key`, donc React peut vérifier
   * ses dépendances ; et on sait à quelles `deps` correspond la donnée
   * affichée, ce qui sert juste en dessous.
   */
  const key = JSON.stringify(deps);
  const [state, setState] = useState<State<T>>({ key, data: undefined, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    load()
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ key, data: undefined, error: errorMessage });
      });

    return () => {
      cancelled = true;
    };
    // `load` et `errorMessage` sont volontairement hors des dépendances : la
    // fonction est recréée à chaque rendu, l'inclure relancerait la requête en
    // boucle. Ce sont les `deps` fournies par l'appelant qui décident.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const setData = useCallback((data: T) => {
    setState((previous) => ({ ...previous, data, error: null }));
  }, []);

  /**
   * Si les `deps` ont changé, la donnée en mémoire concerne l'écran précédent
   * (l'ancien slug, par exemple). On repasse en « chargement » dès ce rendu,
   * plutôt que d'afficher brièvement le contenu d'une autre page.
   */
  const current = state.key === key ? state : { data: undefined, error: null };

  return { data: current.data, error: current.error, reload, setData };
}
