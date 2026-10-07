import type { AdminPathDetail } from './admin';

/**
 * Manques d'un parcours signalés avant sa mise en ligne.
 *
 * Pendant de `publicationGaps` (`lib/entryChecks.ts`) pour les parcours. La
 * règle à reproduire est celle de la page publique (`VISIBLE_STEP_WHERE` et le
 * retrait des modules vides, côté serveur) : une étape dont la fiche est un
 * brouillon n'est pas affichée, et un module sans étape visible disparaît. Un
 * parcours peut donc être « rempli » dans l'éditeur et vide pour un lecteur.
 *
 * Les fonctions sont **pures** (ni DOM ni réseau) : elles lisent le détail déjà
 * chargé par l'éditeur. Comme pour les fiches, la liste est **indicative** :
 * c'est un rappel, le serveur seul décide qui publie.
 */

/** Tableau vide : rien ne manque. */
export function pathPublicationGaps(path: Pick<AdminPathDetail, 'modules'>): string[] {
  if (path.modules.length === 0) {
    return ['Aucun module : la page du parcours sera vide.'];
  }

  const steps = path.modules.flatMap((module) => module.steps);
  if (steps.length === 0) {
    return ['Aucune étape : la page du parcours sera vide.'];
  }

  const hidden = steps.filter((step) => !step.entry.published).length;
  if (hidden === steps.length) {
    return [
      'Toutes les fiches du parcours sont en brouillon : aucune étape ne sera affichée, la page sera vide.',
    ];
  }

  const gaps: string[] = [];

  if (hidden > 0) {
    gaps.push(
      hidden === 1
        ? '1 étape ne sera pas affichée : sa fiche est en brouillon.'
        : `${hidden} étapes ne seront pas affichées : leur fiche est en brouillon.`,
    );
  }

  for (const module of path.modules) {
    if (!module.steps.some((step) => step.entry.published)) {
      gaps.push(`Le module « ${module.title} » n’a aucune étape visible : il ne sera pas affiché.`);
    }
  }

  return gaps;
}

/**
 * Module dont les fiches se lisent **sans compte** : le premier, dans l'ordre
 * du parcours, qui compte au moins une étape dont la fiche est publiée.
 *
 * C'est la règle du serveur (`common/free-access.ts`), reproduite ici pour
 * l'éditeur : un module dont toutes les fiches sont en brouillon n'est pas
 * affiché au public, il ne compte donc pas, et c'est le suivant qui s'ouvre.
 * `null` : aucun module n'a d'étape visible, le parcours n'ouvre aucune fiche.
 *
 * Indication seulement : la règle n'a d'effet que pour un parcours **publié**,
 * et c'est le serveur qui l'applique à chaque lecture.
 */
export function freeModuleId(path: Pick<AdminPathDetail, 'modules'>): string | null {
  const first = path.modules.find((module) => module.steps.some((step) => step.entry.published));

  return first?.id ?? null;
}

/**
 * Question posée avant de mettre en ligne un parcours qui a des manques.
 * `gaps` vient de `pathPublicationGaps` et n'est pas vide.
 */
export function pathPublicationQuestion(gaps: string[]): string {
  return [
    'Ce parcours va être mis en ligne avec des manques :',
    '',
    ...gaps.map((gap) => `- ${gap}`),
    '',
    'Publier quand même ?',
  ].join('\n');
}
