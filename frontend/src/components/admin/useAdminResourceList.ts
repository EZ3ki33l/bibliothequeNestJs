import { useEffect, type DependencyList } from 'react';
import { toast } from '@heroui/react';
import { useAsyncData } from '../../lib/useAsyncData';
import { AdminRefusedError, type AdminListPage } from '../../lib/admin';
import { useUrlPage } from './useUrlPage';

type UseAdminResourceListOptions<T> = {
  /** Charge une page de la ressource (`listAdminStacks`, `listAdminEntries`…). */
  load: (page: number) => Promise<AdminListPage<T>>;
  /** Supprime un élément par id (`deleteAdminStack`…). */
  remove: (id: string) => Promise<void>;
  /** Message si le chargement échoue. */
  loadError: string;
  /**
   * Question posée avant suppression, à partir du nom de l'élément. Elle doit
   * nommer ce qui part (dans une liste de lignes semblables, un clic sur la
   * mauvaise ligne ne se voit pas autrement) et annoncer les effets en cascade.
   */
  confirmMessage: (label: string) => string;
  /** Notification de succès après suppression. */
  deletedMessage: string;
  /** Notification si la suppression échoue. */
  deleteError: string;
  /**
   * Valeurs dont dépend `load` en plus de la page (les filtres d'une liste) :
   * la liste est rechargée quand l'une d'elles change. Valeurs simples
   * uniquement, comme pour `useAsyncData`.
   */
  deps?: DependencyList;
};

/**
 * Plomberie commune aux listes d'administration (stacks, catégories, fiches,
 * parcours) : pagination, chargement, suppression confirmée et notifications.
 *
 * Les écrans étaient identiques à la ponctuation près. Ce qui différait — les
 * libellés, l'icône, le contenu d'une ligne — reste dans les pages, parce que
 * c'est justement ce qu'on veut lire d'un coup d'œil. Ce qui était pareil vit
 * ici, et se corrige donc en un seul endroit.
 */
export function useAdminResourceList<T>(options: UseAdminResourceListOptions<T>) {
  // La page vit dans l'URL : elle survit au passage par un formulaire.
  const { page, setPage } = useUrlPage();

  const { data, error, reload } = useAsyncData(
    () => options.load(page),
    [page, ...(options.deps ?? [])],
    options.loadError,
  );

  /**
   * La page vient de l'URL, donc d'un lien qui peut dater : après des
   * suppressions, `?page=3` peut ne plus exister. Une page vide au-delà de la
   * première ramène à la dernière page réelle, plutôt que d'annoncer une liste
   * vide alors qu'il reste des éléments.
   */
  const lastPage = data === undefined ? undefined : Math.max(1, Math.ceil(data.total / data.limit));
  const isBeyondLastPage = data !== undefined && data.items.length === 0 && page > 1;

  useEffect(() => {
    if (isBeyondLastPage && lastPage !== undefined) {
      setPage(lastPage);
    }
    // `setPage` est recréée à chaque rendu : seules les valeurs qui décident
    // du déplacement sont des dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBeyondLastPage, lastPage]);

  /**
   * Remet la liste à jour après qu'une ligne en est sortie (suppression, ou
   * changement d'état qui ne correspond plus au filtre affiché).
   *
   * Le cas subtil : en retirant le dernier élément d'une page, cette page
   * n'existe plus. Reculer d'une page évite d'afficher une liste vide alors
   * qu'il reste des éléments avant. Changer `page` déclenche le rechargement,
   * d'où le `else` — sinon on chargerait deux fois.
   */
  function reloadAfterRemoval() {
    if (data !== undefined && data.items.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      reload();
    }
  }

  /** Demande confirmation, supprime, puis remet la liste à jour. */
  async function requestDelete(id: string, label: string) {
    if (!window.confirm(options.confirmMessage(label))) {
      return;
    }

    try {
      await options.remove(id);
      toast.success(options.deletedMessage);
      reloadAfterRemoval();
    } catch (caught) {
      // Un refus de droits porte l'explication du serveur ; le reste (réseau,
      // 500) garde le message générique de la page.
      toast.danger(caught instanceof AdminRefusedError ? caught.message : options.deleteError);
    }
  }

  return { page, setPage, data, error, reload, reloadAfterRemoval, requestDelete };
}
