import { entryHrefFromPath } from './learningPaths';
import type { AdjacentSteps } from './pathSteps';

/**
 * Suites proposées sous le résultat d'un examen.
 *
 * Fonction pure : elle décide **quoi** proposer et **dans quel ordre**, le
 * composant `ExamResult` ne fait qu'afficher. Aucun écran de résultat ne laisse
 * sans suite : la liste n'est jamais vide.
 */
export type ExamExit = {
  kind: 'retry' | 'next' | 'path' | 'entry';
  /** Adresse du lien. Absente pour `retry`, qui est une action, pas une page. */
  to?: string;
  label: string;
  /** La suite mise en avant : une seule par résultat. */
  primary: boolean;
};

type ExamExitsInput = {
  passed: boolean;
  entrySlug: string;
  /** Parcours d'où l'examen a été ouvert (`?parcours=`), s'il y en a un. */
  pathSlug: string | null;
  /**
   * Étapes voisines dans ce parcours, déduites de sa lecture **publique**.
   * `null` : parcours inconnu, en brouillon, ou dont la fiche n'est pas une
   * étape. Le résultat se comporte alors comme hors parcours, sans rien révéler.
   */
  steps: AdjacentSteps | null;
};

/**
 * Ordre des suites :
 * - réussi, avec une étape suivante : étape suivante (mise en avant), retour au
 *   parcours, fiche, recommencer ;
 * - réussi, dernière étape : retour au parcours (mis en avant), fiche,
 *   recommencer ;
 * - non réussi : recommencer (mis en avant), fiche, puis retour au parcours
 *   s'il y en a un ;
 * - hors parcours : jamais d'étape suivante ni de retour au parcours.
 */
export function examExits({ passed, entrySlug, pathSlug, steps }: ExamExitsInput): ExamExit[] {
  const inPath = pathSlug !== null && steps !== null;

  const retry = (primary: boolean): ExamExit => ({ kind: 'retry', label: 'Recommencer', primary });
  const entry = (primary: boolean): ExamExit => ({
    kind: 'entry',
    // Dans un parcours, la fiche se rouvre rattachée à ce parcours.
    to: inPath ? entryHrefFromPath(entrySlug, pathSlug) : `/entries/${entrySlug}`,
    label: 'Voir la fiche',
    primary,
  });

  if (!inPath) {
    return passed ? [entry(true), retry(false)] : [retry(true), entry(false)];
  }

  const path = (primary: boolean): ExamExit => ({
    kind: 'path',
    to: `/parcours/${encodeURIComponent(pathSlug)}`,
    label: 'Retour au parcours',
    primary,
  });

  if (!passed) {
    return [retry(true), entry(false), path(false)];
  }

  if (steps.next) {
    return [
      {
        kind: 'next',
        to: entryHrefFromPath(steps.next.slug, pathSlug),
        label: `Étape suivante : ${steps.next.title}`,
        primary: true,
      },
      path(false),
      entry(false),
      retry(false),
    ];
  }

  return [path(true), entry(false), retry(false)];
}

/**
 * Heure locale d'un instant, à la française : « 20 h 15 ». `null` si la valeur
 * reçue n'est pas une date (le message reste alors général).
 */
export function formatRetryTime(iso: string | null): string | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
}
