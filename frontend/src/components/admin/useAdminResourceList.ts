import { useState } from 'react';
import { toast } from '@heroui/react';
import { useAsyncData } from '../../lib/useAsyncData';
import type { AdminListPage } from '../../lib/admin';

type UseAdminResourceListOptions<T> = {
  /** Charge une page de la ressource (`listAdminStacks`, `listAdminEntries`…). */
  load: (page: number) => Promise<AdminListPage<T>>;
  /** Supprime un élément par id (`deleteAdminStack`…). */
  remove: (id: string) => Promise<void>;
  /** Message si le chargement échoue. */
  loadError: string;
  /** Question posée avant suppression — elle doit annoncer les effets en cascade. */
  confirmMessage: string;
  /** Notification de succès après suppression. */
  deletedMessage: string;
  /** Notification si la suppression échoue. */
  deleteError: string;
};

/**
 * Plomberie commune aux trois listes d'administration (stacks, catégories,
 * fiches) : pagination, chargement, suppression confirmée et notifications.
 *
 * Les trois écrans étaient identiques à la ponctuation près. Ce qui différait —
 * les libellés, l'icône, le contenu d'une ligne — reste dans les pages, parce
 * que c'est justement ce qu'on veut lire d'un coup d'œil. Ce qui était pareil
 * vit ici, et se corrige donc en un seul endroit.
 */
export function useAdminResourceList<T>(options: UseAdminResourceListOptions<T>) {
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAsyncData(() => options.load(page), [page], options.loadError);

  /**
   * Demande confirmation, supprime, puis remet la liste à jour.
   *
   * Le cas subtil : en supprimant le dernier élément d'une page, cette page
   * n'existe plus. Reculer d'une page évite d'afficher une liste vide alors
   * qu'il reste des éléments avant. Changer `page` déclenche le rechargement,
   * d'où le `else` — sinon on chargerait deux fois.
   */
  async function requestDelete(id: string) {
    if (!window.confirm(options.confirmMessage)) {
      return;
    }

    try {
      await options.remove(id);
      toast.success(options.deletedMessage);

      if (data !== undefined && data.items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        reload();
      }
    } catch {
      toast.danger(options.deleteError);
    }
  }

  return { page, setPage, data, error, requestDelete };
}
