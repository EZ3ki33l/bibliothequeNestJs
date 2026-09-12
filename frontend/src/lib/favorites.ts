import { apiFetch } from './api';
import type { StackEntry } from './stacks';

/**
 * Appels des favoris.
 *
 * Comme pour les révisions, le serveur ne prend jamais d'identifiant
 * d'utilisateur en paramètre : il le lit dans la session. L'état « de côté »
 * d'une fiche se lit via `listFavorites({ entryId })`, il n'y a pas de champ
 * `favorited` sur `GET /entries/:slug`.
 */

export type FavoriteItem = {
  id: string;
  createdAt: string;
  entry: StackEntry;
};

/** Même enveloppe que les autres listes paginées : `{ items, total, page, limit }`. */
export type FavoritesPage = {
  items: FavoriteItem[];
  total: number;
  page: number;
  limit: number;
};

export type ListFavoritesParams = {
  entryId?: string;
  page?: number;
  limit?: number;
};

export async function listFavorites(
  params: ListFavoritesParams = {},
): Promise<FavoritesPage | 'unauthorized'> {
  const query = new URLSearchParams();

  if (params.entryId) query.set('entryId', params.entryId);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const response = await apiFetch(`/favorites${suffix}`);

  if (response.status === 401) {
    return 'unauthorized';
  }

  if (!response.ok) {
    throw new Error('Impossible de charger les favoris');
  }

  return response.json() as Promise<FavoritesPage>;
}

export type CreateFavoriteResponse = { id: string; entryId: string; createdAt: string };

export async function addFavorite(
  entryId: string,
): Promise<CreateFavoriteResponse | 'unauthorized'> {
  const response = await apiFetch('/favorites', {
    method: 'POST',
    body: JSON.stringify({ entryId }),
  });

  if (response.status === 401) return 'unauthorized';
  if (!response.ok) throw new Error('Impossible de marquer cette fiche');

  return response.json();
}

export async function removeFavorite(entryId: string): Promise<'ok' | 'unauthorized'> {
  const response = await apiFetch(`/favorites/${entryId}`, { method: 'DELETE' });

  if (response.status === 401) return 'unauthorized';
  if (!response.ok) throw new Error('Impossible de retirer ce favori');

  return 'ok';
}
