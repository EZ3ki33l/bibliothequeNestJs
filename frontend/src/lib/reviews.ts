import { apiFetch } from './api';
import type { EntryKind } from './stacks';

/**
 * Appels de la révision espacée.
 *
 * Le serveur ne prend jamais d'identifiant d'utilisateur en paramètre : il le
 * lit dans la session. Une carte qui n'appartient pas à l'utilisateur renvoie
 * donc 404, et non 403 — cela évite de révéler qu'elle existe.
 */

export type DueReviewEntry = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  bodyMdx: string;
  kind: EntryKind;
};

export type DueReviewCard = {
  id: string;
  nextReviewAt: string;
  entry: DueReviewEntry;
};

/**
 * File de révision : la carte à réviser maintenant, et combien il en reste
 * après celle-ci. Une seule carte est envoyée à la fois, pour ne pas dévoiler
 * l'ordre de la file ni charger inutilement.
 */
export type DueReview = {
  current: DueReviewCard | null;
  remaining: number;
};

export async function getDueReview(): Promise<DueReview> {
  const response = await apiFetch('/reviews/due');

  if (!response.ok) {
    throw new Error('Impossible de charger les révisions');
  }

  return response.json();
}

/** Les quatre notes de SM-2, de « à revoir » à « facile ». */
export type ReviewRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

/**
 * Note la carte courante et reçoit directement la suivante.
 *
 * Renvoyer la file mise à jour dans la réponse du POST évite un second aller-retour :
 * la page enchaîne sans temps de chargement entre deux cartes.
 */
export async function rateReview(
  cardId: string,
  rating: ReviewRating,
): Promise<DueReview | 'unauthorized'> {
  const response = await apiFetch(`/reviews/${cardId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  });

  if (response.status === 401) {
    return 'unauthorized';
  }

  if (!response.ok) {
    throw new Error('Impossible d’enregistrer la note');
  }

  return response.json();
}

/**
 * Inscrit la fiche consultée dans la file de révision (sans effet si elle y est
 * déjà).
 *
 * Appelé à l'ouverture d'une fiche. Le 401 est ignoré volontairement : un
 * visiteur non connecté peut lire le catalogue, il n'y a simplement rien à
 * enregistrer, et un message d'erreur serait ici du bruit.
 */
export async function ensureReview(entryId: string): Promise<void> {
  const response = await apiFetch('/reviews/ensure', {
    method: 'POST',
    body: JSON.stringify({ entryId }),
  });

  if (response.status === 401) {
    return;
  }

  if (!response.ok) {
    throw new Error('Impossible d’enregistrer la fiche en révision');
  }
}
