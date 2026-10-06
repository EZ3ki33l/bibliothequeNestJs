export type ProgressStep = {
  id: string;
  entryId: string;
  /** Étape « pour aller plus loin » : visible, mais hors du total. */
  optional: boolean;
};

export type ProgressModule = {
  id: string;
  steps: ProgressStep[];
};

export type ModuleProgress = {
  moduleId: string;
  required: number;
  validatedRequired: number;
};

export type PathProgress = {
  /** Étapes validées, facultatives comprises (pour cocher chaque ligne). */
  validatedStepIds: string[];
  /** Nombre d'étapes obligatoires. */
  required: number;
  /** Parmi elles, combien sont validées. */
  validatedRequired: number;
  modules: ModuleProgress[];
  /** Première étape obligatoire non validée, dans l'ordre du parcours ; `null` sinon. */
  nextStepId: string | null;
  completed: boolean;
};

/**
 * Agrège la progression d'un compte dans un parcours.
 *
 * Fonction **pure** : elle reçoit les modules (déjà réduits à ce qui est
 * visible, dans l'ordre) et l'ensemble des fiches validées, et ne lit ni la
 * base ni l'heure. C'est ce qui permet de tester toutes les règles directement,
 * comme `scoreQuiz` et `scheduleReview`.
 *
 * Règles :
 * - la validation porte sur la **fiche** : une fiche validée l'est dans tous
 *   les parcours qui la contiennent ;
 * - une étape facultative n'entre ni dans les totaux ni dans le choix de la
 *   prochaine étape, mais elle apparaît validée si sa fiche l'est ;
 * - la prochaine étape est la **première** obligatoire non validée dans
 *   l'ordre (modules puis étapes), même si des étapes plus loin sont déjà
 *   validées : le parcours conseille de combler les trous dans l'ordre ;
 * - un parcours sans étape obligatoire n'est jamais « terminé » (il n'y a
 *   rien à terminer) et n'a pas de prochaine étape.
 */
export function computePathProgress(
  modules: ProgressModule[],
  validatedEntryIds: ReadonlySet<string>,
): PathProgress {
  const validatedStepIds: string[] = [];
  const moduleProgress: ModuleProgress[] = [];
  let required = 0;
  let validatedRequired = 0;
  let nextStepId: string | null = null;

  for (const module of modules) {
    let moduleRequired = 0;
    let moduleValidated = 0;

    for (const step of module.steps) {
      const isValidated = validatedEntryIds.has(step.entryId);

      if (isValidated) {
        validatedStepIds.push(step.id);
      }

      if (step.optional) {
        continue;
      }

      moduleRequired += 1;
      if (isValidated) {
        moduleValidated += 1;
      } else if (nextStepId === null) {
        nextStepId = step.id;
      }
    }

    required += moduleRequired;
    validatedRequired += moduleValidated;
    moduleProgress.push({
      moduleId: module.id,
      required: moduleRequired,
      validatedRequired: moduleValidated,
    });
  }

  return {
    validatedStepIds,
    required,
    validatedRequired,
    modules: moduleProgress,
    nextStepId,
    completed: required > 0 && validatedRequired === required,
  };
}
