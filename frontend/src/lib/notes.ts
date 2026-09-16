import { apiFetch } from './api';
import type { StackEntry } from './stacks';

/**
 * Appels des notes personnelles.
 *
 * Comme pour les favoris, le serveur ne prend jamais d'identifiant
 * d'utilisateur en paramètre : il le lit dans la session. Il n'y a pas de
 * champ note sur `GET /entries/:slug` — le contenu se lit via
 * `listNotes({ entryId })`.
 */

export type NoteItem = {
  id: string;
  content: string;
  updatedAt: string;
  entry: StackEntry;
};

export type NotesPage = {
  items: NoteItem[];
  total: number;
  page: number;
  limit: number;
};

export type ListNotesParams = {
  entryId?: string;
  page?: number;
  limit?: number;
};

export async function listNotes(params: ListNotesParams = {}): Promise<NotesPage | 'unauthorized'> {
  const query = new URLSearchParams();

  if (params.entryId) query.set('entryId', params.entryId);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const response = await apiFetch(`/notes${suffix}`);

  if (response.status === 401) {
    return 'unauthorized';
  }

  if (!response.ok) {
    throw new Error('Impossible de charger les notes');
  }

  return response.json() as Promise<NotesPage>;
}

export type SaveNoteResponse = {
  id: string;
  entryId: string;
  content: string;
  updatedAt: string;
};

/**
 * Écrit ou remplace la note sur une fiche. Un contenu vide/espaces supprime
 * la note existante côté serveur : la réponse est alors `204` (`null` ici),
 * qu'une note existait ou non.
 */
export async function saveNote(
  entryId: string,
  content: string,
): Promise<SaveNoteResponse | null | 'unauthorized'> {
  const response = await apiFetch(`/notes/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });

  if (response.status === 401) return 'unauthorized';
  if (response.status === 204) return null;
  if (!response.ok) throw new Error('Impossible d’enregistrer cette note');

  return response.json() as Promise<SaveNoteResponse>;
}

export async function deleteNote(entryId: string): Promise<'ok' | 'unauthorized'> {
  const response = await apiFetch(`/notes/${entryId}`, { method: 'DELETE' });

  if (response.status === 401) return 'unauthorized';
  if (!response.ok) throw new Error('Impossible de supprimer cette note');

  return 'ok';
}
