import type { Difficulty, EntryKind } from './stacks';

/**
 * Traductions des valeurs stockées en base.
 *
 * Prisma garde des identifiants stables en anglais (`FUNCTION`, `BEGINNER`) ;
 * l'affichage est en français. Faire cette correspondance ici — et pas dans
 * chaque composant — évite qu'un même type s'appelle « Fonction » sur une page
 * et « Function » sur une autre.
 *
 * `Record<EntryKind, string>` garantit qu'ajouter une valeur à l'énumération
 * casse la compilation tant que son libellé manque.
 */
export const KIND_LABEL: Record<EntryKind, string> = {
  FUNCTION: 'Fonction',
  COMPONENT: 'Composant',
  CONCEPT: 'Concept',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé',
};

/** Couleur de la puce de difficulté : vert, orange, rouge. */
export const DIFFICULTY_COLOR: Record<Difficulty, 'success' | 'warning' | 'danger'> = {
  BEGINNER: 'success',
  INTERMEDIATE: 'warning',
  ADVANCED: 'danger',
};
