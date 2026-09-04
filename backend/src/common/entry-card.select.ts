import { Prisma } from '../generated/prisma/client';

/**
 * Colonnes d'une fiche telle qu'elle apparaît **dans une liste** (page d'un
 * stack, page d'une catégorie).
 *
 * Deux raisons de la définir une seule fois :
 *
 * 1. Sécurité. Sans `select`, Prisma renvoie toute la ligne : `bodyMdx`
 *    entier, `published`, et la colonne `quizQuestions`. Une liste publique n'a
 *    besoin d'aucun des trois. Choisir explicitement ce qui sort est la règle —
 *    on n'expose jamais un modèle de base tel quel.
 * 2. Cohérence. Les deux endpoints publics renvoient la même forme, ce qui
 *    permet au frontend de n'avoir qu'un seul type (`StackEntry`) pour les deux.
 *
 * `satisfies` vérifie que l'objet est un `select` Prisma valide tout en gardant
 * le type littéral exact, donc le typage précis du résultat de la requête.
 */
export const ENTRY_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  kind: true,
  difficulty: true,
  tags: true,
} satisfies Prisma.EntrySelect;
