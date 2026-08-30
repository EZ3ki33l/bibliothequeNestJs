import { apiFetch } from './api';
import type { EntryKind } from './stacks';

export type MeResult = 'ok' | 'unauthorized';

export async function getMe(): Promise<MeResult> {
  const response = await apiFetch('/me');

  if (response.status === 401) {
    return 'unauthorized';
  }

  if (!response.ok) {
    throw new Error('Impossible de vérifier la session');
  }

  return 'ok';
}

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

export type ReviewRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

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
