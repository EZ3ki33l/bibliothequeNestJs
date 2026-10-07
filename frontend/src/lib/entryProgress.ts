import { apiFetch } from './api';

/**
 * Ce que le compte connecté a fait des fiches : trace de lecture et repères.
 *
 * Ces appels passent par des routes **sous session** (`/progress/entries`),
 * distinctes des lectures publiques du catalogue : une lecture publique répond
 * la même chose à tout le monde, ce qui est personnel se demande ici. Aucun
 * identifiant de compte ne part dans la requête, le serveur le lit dans la
 * session.
 */

/** Repères d'une fiche pour le compte connecté. */
export type EntryState = {
  /** La fiche a été ouverte par ce compte. */
  read: boolean;
  /** Meilleur score des examens terminés, `null` s'il n'y en a pas. */
  bestScore: number | null;
  /** Le meilleur score atteint le seuil de réussite. */
  passed: boolean;
  favorite: boolean;
};

export type EntryStates = {
  /** Seuil de réussite, fourni par le serveur : jamais recopié ici. */
  passingScore: number;
  byEntryId: Map<string, EntryState>;
};

/** Nombre de fiches par requête : la borne du DTO serveur (`MAX_ENTRY_IDS`). */
const ENTRY_STATES_CHUNK = 50;

/**
 * Compte la fiche comme lue (`PUT /progress/entries/:entryId/read`, idempotent).
 *
 * 401, 403 et 404 ne sont pas des erreurs : un visiteur n'a rien à
 * enregistrer, une fiche que le compte ne peut pas lire ne se compte pas comme
 * lue (le serveur le refuse), et une fiche dépubliée entre-temps n'a plus de
 * trace à recevoir. Toute autre réponse lève une erreur, que l'appelant
 * ignore : l'échec de cet enregistrement ne doit jamais empêcher de lire la
 * fiche.
 */
export async function markEntryRead(entryId: string): Promise<void> {
  const response = await apiFetch(`/progress/entries/${encodeURIComponent(entryId)}/read`, {
    method: 'PUT',
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new Error('Impossible d’enregistrer la lecture');
  }
}

type EntryStatesResponse = {
  passingScore: number;
  items: ({ entryId: string } & EntryState)[];
};

/**
 * Repères du compte pour une liste de fiches.
 *
 * Le serveur accepte 50 identifiants par requête : la liste est découpée en
 * tranches, demandées en parallèle, puis fusionnée dans une seule `Map`.
 *
 * `null` : il n'y a rien à afficher (visiteur, ou liste vide). Une fiche
 * absente de la `Map` n'a simplement aucun repère : le serveur omet les fiches
 * inconnues ou dépubliées, sans erreur.
 */
export async function getEntryStates(entryIds: readonly string[]): Promise<EntryStates | null> {
  const ids = [...new Set(entryIds)];

  if (ids.length === 0) {
    return null;
  }

  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += ENTRY_STATES_CHUNK) {
    chunks.push(ids.slice(start, start + ENTRY_STATES_CHUNK));
  }

  const responses = await Promise.all(
    chunks.map((chunk) => apiFetch(`/progress/entries?ids=${chunk.join(',')}`)),
  );

  if (responses.some((response) => response.status === 401)) {
    return null;
  }

  if (responses.some((response) => !response.ok)) {
    throw new Error('Impossible de charger les repères');
  }

  const pages = (await Promise.all(
    responses.map((response) => response.json()),
  )) as EntryStatesResponse[];

  const byEntryId = new Map<string, EntryState>();
  for (const page of pages) {
    for (const { entryId, ...state } of page.items) {
      byEntryId.set(entryId, state);
    }
  }

  return { passingScore: pages[0].passingScore, byEntryId };
}
