import { apiFetch } from './api';
import { useAsyncData } from './useAsyncData';
import { accessMention, useViewerAccess } from './viewerAccess';

/**
 * Accès des fiches : en accès libre (lisible sans compte) ou réservée.
 *
 * L'information est **publique** et identique pour tous : elle se lit déjà sur
 * la page d'un parcours, dont le premier module est ouvert. Ces lectures
 * (`/access/...`) ne passent donc par aucune session. Elles ne servent qu'à
 * annoncer la règle avant d'ouvrir une fiche (mention sur une carte, alerte de
 * l'administration) : le contenu, lui, est gardé par le serveur.
 */

/** Nombre de fiches par requête : la borne du DTO serveur (`MAX_ENTRY_IDS`). */
const ENTRY_ACCESS_CHUNK = 50;

type EntryAccessResponse = { items: { entryId: string; free: boolean }[] };

/**
 * Accès d'une liste de fiches (`GET /access/entries?ids=`) : identifiant →
 * `true` si la fiche est en accès libre.
 *
 * Le serveur accepte 50 identifiants par requête : la liste est découpée en
 * tranches, demandées en parallèle, puis fusionnée. Une fiche absente de la
 * `Map` est inconnue ou dépubliée : le serveur l'omet, sans erreur.
 */
export async function getEntryAccess(entryIds: readonly string[]): Promise<Map<string, boolean>> {
  const ids = [...new Set(entryIds)];
  const access = new Map<string, boolean>();

  if (ids.length === 0) {
    return access;
  }

  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += ENTRY_ACCESS_CHUNK) {
    chunks.push(ids.slice(start, start + ENTRY_ACCESS_CHUNK));
  }

  const responses = await Promise.all(
    chunks.map((chunk) => apiFetch(`/access/entries?ids=${chunk.join(',')}`)),
  );

  if (responses.some((response) => !response.ok)) {
    throw new Error('Impossible de charger l’accès des fiches');
  }

  const pages = (await Promise.all(
    responses.map((response) => response.json()),
  )) as EntryAccessResponse[];

  for (const page of pages) {
    for (const { entryId, free } of page.items) {
      access.set(entryId, free);
    }
  }

  return access;
}

/**
 * Identifiants des fiches **réservées** parmi celles affichées.
 *
 * `undefined` dans tous les cas où aucune mention n'est à montrer : lecteur
 * vérifié (il lit tout, la requête n'est même pas émise), lecteur encore
 * indéterminé, liste vide, chargement en cours ou lecture en échec. Une mention
 * absente un instant vaut mieux qu'une mention fausse, et une liste reste
 * utilisable quand cette lecture échoue.
 */
export function useReservedEntryIds(entryIds: readonly string[]): Set<string> | undefined {
  const viewer = useViewerAccess();
  const wanted = viewer === 'visitor' || viewer === 'unverified';

  // Une chaîne, pour que le hook ne recharge que si la liste change vraiment
  // (un tableau recréé à chaque rendu serait toujours « différent »).
  const key = entryIds.join(',');

  const { data } = useAsyncData(
    async () => {
      if (!wanted || !key) return null;

      const access = await getEntryAccess(key.split(','));
      return new Set([...access].filter(([, free]) => !free).map(([entryId]) => entryId));
    },
    [wanted, key],
    'Impossible de charger l’accès des fiches',
  );

  return data ?? undefined;
}

/**
 * Mention d'accès de chaque fiche affichée : « Compte requis » pour un
 * visiteur, « Adresse à vérifier » pour un compte non vérifié, rien pour une
 * fiche en accès libre ou un compte vérifié.
 *
 * Renvoie une fonction, à appeler pour chaque carte ou étape : `undefined`
 * quand il n'y a pas de mention.
 */
export function useAccessMentions(
  entryIds: readonly string[],
): (entryId: string) => string | undefined {
  const viewer = useViewerAccess();
  const reservedIds = useReservedEntryIds(entryIds);

  return (entryId) => accessMention(viewer, !reservedIds?.has(entryId)) ?? undefined;
}

/** `GET /access/summary` : nombre de fiches lisibles sans compte. */
export async function getAccessSummary(): Promise<{ freeEntryCount: number }> {
  const response = await apiFetch('/access/summary');

  if (!response.ok) {
    throw new Error('Impossible de charger l’accès des fiches');
  }

  return response.json() as Promise<{ freeEntryCount: number }>;
}
