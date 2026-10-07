import { apiFetch } from './api';
import type { StackEntry } from './stacks';

/**
 * Appels publics des parcours guidés.
 *
 * Un parcours ne possède pas ses fiches : chaque étape **référence** une fiche
 * du catalogue, quel que soit son stack. D'où la catégorie et le stack joints à
 * chaque fiche, pour que la page puisse indiquer d'où vient une étape.
 *
 * Ces lectures ne lisent pas la session : un visiteur et un compte connecté
 * reçoivent la même réponse. La progression personnelle passe par d'autres
 * routes, sous session.
 */

export type PathListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Étapes dont la fiche est publiée (facultatives comprises). */
  stepCount: number;
};

/** Même enveloppe que les autres listes paginées : `{ items, total, page, limit }`. */
export type PathListPage = {
  items: PathListItem[];
  total: number;
  page: number;
  limit: number;
};

export type PathEntry = StackEntry & {
  category: {
    id: string;
    name: string;
    slug: string;
    stack: { id: string; name: string; slug: string };
  };
};

export type PathStep = {
  id: string;
  /** Étape « pour aller plus loin » : hors du total de progression. */
  optional: boolean;
  entry: PathEntry;
};

export type PathModule = {
  id: string;
  title: string;
  description: string;
  steps: PathStep[];
};

export type PathDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Vide si aucune étape n'est encore publiée : parcours « en préparation ». */
  modules: PathModule[];
};

export async function listLearningPaths(page?: number): Promise<PathListPage> {
  const suffix = page !== undefined && page > 1 ? `?page=${page}` : '';
  const response = await apiFetch(`/learning-paths${suffix}`);

  if (!response.ok) {
    throw new Error('Impossible de charger les parcours');
  }

  return response.json() as Promise<PathListPage>;
}

/**
 * Plan d'un parcours publié. Le 404 (slug inconnu **ou** brouillon, le serveur
 * ne fait pas la différence) devient `null` : la page affiche « introuvable »
 * plutôt qu'une erreur technique.
 */
export async function getLearningPath(slug: string): Promise<PathDetail | null> {
  const response = await apiFetch(`/learning-paths/${encodeURIComponent(slug)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Impossible de charger le parcours');
  }

  return response.json() as Promise<PathDetail>;
}

/**
 * Adresse d'une fiche ouverte depuis un parcours.
 *
 * Le paramètre `parcours` ne sert qu'à afficher « Retour au parcours » sur la
 * fiche : il n'ouvre aucun droit et ne déclenche aucun appel.
 */
export function entryHrefFromPath(entrySlug: string, pathSlug: string): string {
  return `/entries/${entrySlug}?parcours=${encodeURIComponent(pathSlug)}`;
}

/**
 * Adresse de l'examen d'une fiche. Ouverte depuis un parcours, la fiche
 * transmet ce parcours à son examen : le résultat pourra proposer l'étape
 * suivante. Comme pour la fiche, le paramètre ne porte qu'un slug et n'ouvre
 * aucun droit.
 */
export function examHrefFromPath(entrySlug: string, pathSlug: string | null): string {
  const base = `/entries/${entrySlug}/exam`;

  return pathSlug ? `${base}?parcours=${encodeURIComponent(pathSlug)}` : base;
}

// ---------------------------------------------------------------------------
// Progression (session requise)
// ---------------------------------------------------------------------------

export type PathModuleProgress = {
  moduleId: string;
  required: number;
  validatedRequired: number;
};

/**
 * Progression du compte connecté dans un parcours. Elle est **déduite** côté
 * serveur (examen réussi, ou consultation d'une fiche trop courte pour un
 * examen) : il n'existe aucune case « terminé » à cocher.
 */
export type PathProgress = {
  pathId: string;
  /** Score qui valide une étape, fourni par le serveur. */
  passingScore: number;
  /** Étapes validées, facultatives comprises. */
  validatedStepIds: string[];
  /** Étapes obligatoires, et combien sont validées. */
  required: number;
  validatedRequired: number;
  modules: PathModuleProgress[];
  /** Première étape obligatoire non validée ; `null` si terminé. */
  nextStepId: string | null;
  completed: boolean;
};

export type PathProgressSummary = {
  pathId: string;
  required: number;
  validatedRequired: number;
  completed: boolean;
};

export type PathProgressPage = {
  items: PathProgressSummary[];
  total: number;
  page: number;
  limit: number;
};

/**
 * Lecture de progression : `null` pour un visiteur (401) ou un parcours
 * introuvable (404). Dans les deux cas, la page affiche simplement le parcours
 * sans indicateurs — ce n'est pas une erreur.
 */
async function readProgress<T>(path: string): Promise<T | null> {
  const response = await apiFetch(path);

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Impossible de charger la progression');
  }

  return response.json() as Promise<T>;
}

export function getPathProgress(slug: string): Promise<PathProgress | null> {
  return readProgress<PathProgress>(`/progress/learning-paths/${encodeURIComponent(slug)}`);
}

/** Même pagination que `listLearningPaths` : les deux pages se fusionnent par `pathId`. */
export function listPathProgress(page?: number): Promise<PathProgressPage | null> {
  const suffix = page !== undefined && page > 1 ? `?page=${page}` : '';
  return readProgress<PathProgressPage>(`/progress/learning-paths${suffix}`);
}

/**
 * Parcours commencé par le compte, tel que l'accueil le propose : progression
 * et prochaine étape conseillée.
 */
export type StartedPath = {
  pathId: string;
  slug: string;
  name: string;
  required: number;
  validatedRequired: number;
  completed: boolean;
  /** `null` : parcours terminé, ou sans étape obligatoire. */
  nextStep: { entrySlug: string; title: string } | null;
  lastActivityAt: string;
};

export type StartedPaths = {
  /** Trois au plus, le plus récemment suivi d'abord. */
  items: StartedPath[];
  /** Nombre de parcours commencés : supérieur à `items.length` s'il y en a d'autres. */
  total: number;
};

/** Parcours commencés par le compte connecté ; `null` pour un visiteur (401). */
export function getStartedPaths(): Promise<StartedPaths | null> {
  return readProgress<StartedPaths>('/progress/started-paths');
}
