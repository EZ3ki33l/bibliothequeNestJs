import { authClient } from './auth';
import { getEntryStates, type EntryStates } from './entryProgress';
import { useAsyncData } from './useAsyncData';

/**
 * Repères (lue, examen réussi, favori) du compte connecté pour les fiches
 * affichées.
 *
 * `undefined` dans tous les cas où il n'y a rien à montrer : chargement en
 * cours, visiteur, liste vide, ou lecture en échec. L'appelant n'a donc qu'un
 * cas à traiter, et une liste reste utilisable quand les repères manquent.
 *
 * `useSession()` ne sert ici qu'à **éviter une requête** vouée au 401 pour
 * chaque visiteur. Ce n'est pas une garde : c'est le serveur qui décide, à
 * partir du cookie, de ce qu'il renvoie et pour quel compte.
 */
export function useEntryStates(entryIds: readonly string[]): EntryStates | undefined {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  // Une chaîne, pour que le hook ne recharge que si la liste change vraiment
  // (un tableau recréé à chaque rendu serait toujours « différent »).
  const key = entryIds.join(',');

  const { data } = useAsyncData(
    () => (userId && key ? getEntryStates(key.split(',')) : Promise.resolve(null)),
    [userId, key],
    'Impossible de charger les repères',
  );

  return data ?? undefined;
}
