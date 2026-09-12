import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, Skeleton } from '@heroui/react';
import { getMe } from '../lib/auth';
import {
  listFavorites,
  removeFavorite,
  type FavoritesPage as FavoritesPageData,
} from '../lib/favorites';
import { useAsyncData } from '../lib/useAsyncData';
import { EmptyMessage } from '../components/ui/EmptyMessage';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EntryCard } from '../components/ui/EntryCard';
import { HeartIcon } from '../components/ui/HeartIcon';
import { PageHeader } from '../components/ui/PageHeader';

/** `'unauthorized'` : session absente, la redirection est en cours. */
type FavoritesState = FavoritesPageData | 'unauthorized';

/**
 * Écran d'apprenant (pas d'admin) : les fiches publiées mises de côté par le
 * compte connecté.
 *
 * L'état « favori » vient toujours de `GET /favorites` — jamais d'un champ
 * `favorited` sur `GET /entries/:slug`, qui n'existe pas. Comme `/review`,
 * la garde est `GET /me` (401 → `/login`), pas `useSession()`.
 */
export function FavoritesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  // `entryId` de la ligne en cours de retrait : désactive son propre bouton
  // sans geler le reste de la liste.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { data, error, setData } = useAsyncData<FavoritesState>(
    async () => {
      const me = await getMe();
      return me === 'unauthorized' ? 'unauthorized' : listFavorites({ page });
    },
    [page],
    'Impossible de charger les favoris',
  );

  useEffect(() => {
    if (data === 'unauthorized') {
      navigate('/login', { replace: true });
    }
  }, [data, navigate]);

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  }

  /**
   * Retire un favori de la liste.
   *
   * La fiche catalogue n'est pas supprimée — seule la ligne `Favorite`
   * disparaît. Le retrait de l'écran (`setData`) évite un second `GET
   * /favorites` juste pour rafraîchir une ligne en moins.
   */
  async function onRemove(entryId: string) {
    if (!data || data === 'unauthorized' || removingId) return;

    setRemovingId(entryId);
    setRemoveError(null);

    try {
      const result = await removeFavorite(entryId);

      if (result === 'unauthorized') {
        navigate('/login', { replace: true });
        return;
      }

      setData({
        ...data,
        items: data.items.filter((favorite) => favorite.entry.id !== entryId),
        total: Math.max(0, data.total - 1),
      });
    } catch (caught) {
      setRemoveError(caught instanceof Error ? caught.message : 'Impossible de retirer ce favori');
    } finally {
      setRemovingId(null);
    }
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  // Chargement, ou redirection déjà lancée.
  if (data === undefined || data === 'unauthorized') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Favoris" description="Fiches publiées mises de côté sur ce compte." />

      {removeError ? <ErrorMessage>{removeError}</ErrorMessage> : null}

      {data.items.length === 0 ? (
        <EmptyMessage>Aucun favori pour le moment.</EmptyMessage>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.items.map((favorite) => (
              <li key={favorite.id} className="relative">
                <EntryCard entry={favorite.entry} />
                {/* Frère du `<Link>` de la carte, pas un enfant : un bouton ne
                    peut pas être imbriqué dans un lien (HTML), et un clic
                    dessus ne doit de toute façon pas naviguer vers la fiche. */}
                <Button
                  type="button"
                  variant="ghost"
                  isIconOnly
                  size="sm"
                  isDisabled={removingId === favorite.entry.id}
                  aria-label="Retirer des favoris"
                  className="bg-background absolute top-3 right-3"
                  onPress={() => {
                    void onRemove(favorite.entry.id);
                  }}
                >
                  <HeartIcon filled className="text-danger size-4" />
                </Button>
              </li>
            ))}
          </ul>
          {data.total > data.limit ? (
            <div className="text-muted mt-6 flex items-center gap-3 text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page <= 1}
                onPress={() => goToPage(page - 1)}
              >
                Précédent
              </Button>
              <span>
                Page {page} · {data.total} au total
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={page * data.limit >= data.total}
                onPress={() => goToPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
