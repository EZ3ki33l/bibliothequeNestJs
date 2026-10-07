import type { PathDetail, PathEntry } from './learningPaths';

/**
 * Étapes voisines d'une fiche dans un parcours.
 *
 * Elles sont **déduites** du plan public du parcours (`GET /learning-paths/:slug`)
 * au moment d'afficher la fiche, jamais enregistrées. Ce plan ne contient que
 * ce que la page du parcours montre déjà : parcours publié, étapes dont la
 * fiche est publiée, modules vides retirés. Les liens d'étape ne peuvent donc
 * ni révéler un brouillon ni diverger de l'ordre affiché sur le parcours.
 */
export type AdjacentSteps = {
  /** `null` : la fiche est la première étape du parcours. */
  previous: PathEntry | null;
  /** `null` : la fiche est la dernière étape du parcours. */
  next: PathEntry | null;
};

/**
 * `null` quand il n'y a rien à proposer : parcours absent (inconnu, brouillon,
 * pas encore chargé, lecture en échec) ou fiche qui n'en est pas une étape.
 *
 * Les modules sont aplatis en une seule suite d'étapes : passer de la dernière
 * étape d'un module à la première du suivant n'est pas un cas particulier. Les
 * étapes facultatives en font partie, puisque la page du parcours les montre.
 */
export function adjacentSteps(
  path: PathDetail | null | undefined,
  entrySlug: string,
): AdjacentSteps | null {
  if (!path) {
    return null;
  }

  const entries = path.modules.flatMap((module) => module.steps.map((step) => step.entry));
  const index = entries.findIndex((entry) => entry.slug === entrySlug);

  if (index === -1) {
    return null;
  }

  return {
    previous: entries[index - 1] ?? null,
    next: entries[index + 1] ?? null,
  };
}
