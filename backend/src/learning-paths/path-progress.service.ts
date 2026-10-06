import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isQuizEligible, PASSING_SCORE } from '../common/quiz-eligibility';
import { computePathProgress, type ProgressModule } from '../common/path-progress';
import {
  LearningPathsService,
  PUBLISHED_PATHS_ORDER,
  PUBLISHED_PATHS_WHERE,
  VISIBLE_STEP_WHERE,
} from './learning-paths.service';

/**
 * Progression d'un compte dans les parcours.
 *
 * Rien n'est stocké : la progression se **déduit** des examens réussis et des
 * fiches consultées (`QuizAttempt`, `ReviewCard`), qui existent déjà. Pas de
 * seconde source de vérité à synchroniser, et pas de nouvelle donnée
 * personnelle à supprimer avec le compte.
 *
 * Seul service de la feature à recevoir un `userId` : il vient toujours de la
 * session, et figure dans chaque `where` qui lit une donnée de compte.
 */
@Injectable()
export class PathProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningPathsService: LearningPathsService,
  ) {}

  /**
   * Fiches validées par ce compte parmi `entryIds`.
   *
   * Une fiche est validée si :
   * 1. un examen **terminé** a obtenu au moins `PASSING_SCORE` (un examen en
   *    cours a `score: null` et ne compte pas ; un échec ultérieur n'annule
   *    rien, puisqu'il suffit qu'un examen réussi **existe**) ;
   * 2. ou, pour une fiche trop courte pour avoir un examen, si elle a été
   *    ouverte (ouvrir une fiche crée sa carte de révision).
   *
   * Lire `bodyMdx` coûte cher : on ne le fait que pour les candidats de la
   * règle 2 (carte présente, pas d'examen réussi), jamais pour tout le parcours.
   */
  async validatedEntryIds(userId: string, ids: string[]): Promise<Set<string>> {
    // Une fiche présente dans plusieurs parcours d'une même page n'est
    // cherchée qu'une fois.
    const entryIds = [...new Set(ids)];
    if (entryIds.length === 0) {
      return new Set();
    }

    const passed = await this.prisma.quizAttempt.findMany({
      where: { userId, entryId: { in: entryIds }, score: { gte: PASSING_SCORE } },
      select: { entryId: true },
      distinct: ['entryId'],
    });
    const validated = new Set(passed.map((attempt) => attempt.entryId));

    const remaining = entryIds.filter((entryId) => !validated.has(entryId));
    if (remaining.length === 0) {
      return validated;
    }

    const cards = await this.prisma.reviewCard.findMany({
      where: { userId, entryId: { in: remaining } },
      select: { entryId: true },
    });
    if (cards.length === 0) {
      return validated;
    }

    const candidates = await this.prisma.entry.findMany({
      where: { id: { in: cards.map((card) => card.entryId) } },
      select: { id: true, bodyMdx: true },
    });
    for (const entry of candidates) {
      if (!isQuizEligible(entry.bodyMdx)) {
        validated.add(entry.id);
      }
    }

    return validated;
  }

  /**
   * Progression détaillée dans un parcours publié.
   *
   * La structure vient de `findPublishedBySlug`, la même que la page publique :
   * étapes brouillons et modules vides sont exclus de la même façon, et un
   * parcours brouillon ou inconnu donne le même 404.
   */
  async findForPath(userId: string, slug: string) {
    const path = await this.learningPathsService.findPublishedBySlug(slug);

    const modules: ProgressModule[] = path.modules.map((module) => ({
      id: module.id,
      steps: module.steps.map((step) => ({
        id: step.id,
        entryId: step.entry.id,
        optional: step.optional,
      })),
    }));

    const validated = await this.validatedEntryIds(
      userId,
      modules.flatMap((module) => module.steps.map((step) => step.entryId)),
    );
    return { pathId: path.id, ...computePathProgress(modules, validated) };
  }

  /**
   * Résumé de progression pour une page de la liste publique : mêmes parcours,
   * même ordre, même pagination que `GET /learning-paths`. Une seule recherche
   * de validations couvre toutes les fiches de la page.
   */
  async findPage(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [paths, total] = await Promise.all([
      this.prisma.learningPath.findMany({
        where: PUBLISHED_PATHS_WHERE,
        skip,
        take: limit,
        orderBy: PUBLISHED_PATHS_ORDER,
        select: {
          id: true,
          modules: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              steps: {
                where: VISIBLE_STEP_WHERE,
                orderBy: { position: 'asc' },
                select: { id: true, entryId: true, optional: true },
              },
            },
          },
        },
      }),
      this.prisma.learningPath.count({ where: PUBLISHED_PATHS_WHERE }),
    ]);

    const validated = await this.validatedEntryIds(
      userId,
      paths.flatMap((path) =>
        path.modules.flatMap((module) => module.steps.map((step) => step.entryId)),
      ),
    );

    const items = paths.map((path) => {
      const progress = computePathProgress(path.modules, validated);
      return {
        pathId: path.id,
        required: progress.required,
        validatedRequired: progress.validatedRequired,
        completed: progress.completed,
      };
    });

    return { items, total, page, limit };
  }
}
