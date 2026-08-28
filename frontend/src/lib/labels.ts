import type { Difficulty, EntryKind } from './stacks';

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

export const DIFFICULTY_COLOR: Record<Difficulty, 'success' | 'warning' | 'danger'> = {
  BEGINNER: 'success',
  INTERMEDIATE: 'warning',
  ADVANCED: 'danger',
};
