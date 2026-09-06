import { Prisma } from '../generated/prisma/client';

/**
 * Colonnes d'une fiche telle qu'elle apparaît **dans une liste** (page d'un
 * stack, page d'une catégorie, et désormais `GET /entries` paginé).
 *
 * Deux raisons de la définir une seule fois :
 *
 * 1. Sécurité. Sans `select`, Prisma renvoie toute la ligne : `bodyMdx`
 *    entier, `published`, et la colonne `quizQuestions`. Une liste publique n'a
 *    besoin d'aucun des trois. Choisir explicitement ce qui sort est la règle —
 *    on n'expose jamais un modèle de base tel quel.
 * 2. Cohérence. Les endpoints publics de liste renvoient la même forme.
 *
 * `category.stack` (id, name, slug) permet d'afficher le parcours sur une
 * carte de recherche, sans `bodyMdx` / `files` / `quizQuestions`.
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
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      stack: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.EntrySelect;
