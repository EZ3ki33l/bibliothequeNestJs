import type { EntryKind, SandpackFiles } from './stacks';

/**
 * Règles d'affichage d'une fiche et manques signalés, écrits une seule fois.
 *
 * La page publique et l'aperçu de l'administration doivent décider de la même
 * façon si un playground apparaît. Recopier la condition dans chaque composant,
 * c'est accepter qu'un jour l'aperçu annonce un playground que la page publique
 * n'affiche pas. Les fonctions sont **pures** (même entrée, même sortie, ni DOM
 * ni réseau) : toute modification de la règle se fait ici, nulle part ailleurs.
 */

/**
 * - `shown` : le playground est affiché ;
 * - `concept` : la fiche est un concept, elle s'explique et ne s'exécute pas ;
 * - `no-files` : la fiche pourrait en avoir un, mais aucun fichier n'est fourni.
 */
export type PlaygroundStatus = 'shown' | 'concept' | 'no-files';

/**
 * `files` vaut `undefined` quand il n'y a aucun fichier : c'est ce que renvoie
 * `jsonToStringRecord` pour un objet vide, côté public comme côté aperçu.
 *
 * Le type est testé en premier : un concept reste `concept` même si des
 * fichiers ont été renseignés.
 */
export function playgroundStatus(
  kind: EntryKind,
  files: SandpackFiles | undefined,
): PlaygroundStatus {
  if (kind === 'CONCEPT') {
    return 'concept';
  }

  return files === undefined ? 'no-files' : 'shown';
}

/**
 * Manques signalés avant une mise en ligne. Tableau vide : rien ne manque.
 *
 * La liste est volontairement courte et **indicative** : une fiche brève ou
 * sans playground peut être voulue. Elle sert à l'aperçu (rappel permanent) et
 * à la confirmation du formulaire, qui affichent ainsi les mêmes messages.
 *
 * Deux absences assumées :
 * - un concept sans fichier n'a pas de manque de playground, c'est son état
 *   normal (`playgroundStatus` renvoie alors `concept`, pas `no-files`) ;
 * - l'éligibilité à l'examen n'est pas testée : son seuil appartient au
 *   backend (`quiz-eligibility.ts`) et ne se recopie pas ici.
 *
 * Les champs sont attendus déjà normalisés (`trim()` fait par
 * `readEntryFields`) : « vide » signifie donc une chaîne vide.
 */
export function publicationGaps(fields: {
  summary: string;
  bodyMdx: string;
  kind: EntryKind;
  files: SandpackFiles | undefined;
  /** Nombre de sources citées par la fiche. */
  sourceCount: number;
}): string[] {
  const gaps: string[] = [];

  if (fields.bodyMdx === '') {
    gaps.push('Le corps est vide.');
  }
  if (fields.summary === '') {
    gaps.push('Le résumé est vide.');
  }
  if (playgroundStatus(fields.kind, fields.files) === 'no-files') {
    gaps.push('Aucun fichier : le playground n’apparaîtra pas.');
  }
  // Une fiche reprend presque toujours un document existant : ne pas le citer
  // est le plus souvent un oubli. Le manque reste indicatif, comme les autres.
  if (fields.sourceCount === 0) {
    gaps.push('Aucune source n’est citée.');
  }

  return gaps;
}

/**
 * Question posée avant de mettre en ligne une fiche qui a des manques.
 *
 * Le formulaire et la liste des fiches publient tous les deux : le texte est
 * écrit ici pour que la question soit la même aux deux endroits. `gaps` vient de
 * `publicationGaps` et n'est pas vide (sans manque, aucune question n'est posée).
 */
export function publicationQuestion(gaps: string[]): string {
  return [
    'Cette fiche va être mise en ligne avec des manques :',
    '',
    ...gaps.map((gap) => `- ${gap}`),
    '',
    'Publier quand même ?',
  ].join('\n');
}
