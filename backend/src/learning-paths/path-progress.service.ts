import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isQuizEligible, PASSING_SCORE } from '../common/quiz-eligibility';
import { computePathProgress, type ProgressModule } from '../common/path-progress';
import { lastActivity, rankStartedPaths } from '../common/started-paths';
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
 * fiches lues (`QuizAttempt`, `EntryRead`), qui existent déjà. Pas de seconde
 * source de vérité à synchroniser, et pas de nouvelle donnée personnelle à
 * supprimer avec le compte.
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
   *    lue (ouvrir une fiche enregistre sa trace de lecture, `EntryRead`).
   *
   * Lire `bodyMdx` coûte cher : on ne le fait que pour les candidats de la
   * règle 2 (trace présente, pas d'examen réussi), jamais pour tout le parcours.
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

    const reads = await this.prisma.entryRead.findMany({
      where: { userId, entryId: { in: remaining } },
      select: { entryId: true },
    });
    if (reads.length === 0) {
      return validated;
    }

    const candidates = await this.prisma.entry.findMany({
      where: { id: { in: reads.map((read) => read.entryId) } },
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
   *
   * `passingScore` accompagne la réponse : la page affiche le seuil qui valide
   * réellement une étape, sans le recopier dans le navigateur.
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
    return {
      pathId: path.id,
      passingScore: PASSING_SCORE,
      ...computePathProgress(modules, validated),
    };
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

  /**
   * Parcours commencés par le compte, le plus récemment suivi d'abord, pour
   * l'accueil : `limit` au plus, et `total` pour savoir s'il y en a d'autres.
   *
   * Un parcours est **commencé** dès qu'une de ses fiches visibles a une trace
   * de lecture ou un examen terminé du compte. Le filtre est posé dans la
   * requête (relations `reads` et `quizAttempts`, toutes deux sur `userId`) : la
   * base ne renvoie que les parcours concernés, au lieu de tous les paginer.
   *
   * Mêmes règles de visibilité que la lecture publique : parcours publiés,
   * étapes dont la fiche est publiée, modules vides écartés. Une fiche
   * dépubliée ne compte ni dans la progression ni comme activité.
   *
   * La progression vient de `computePathProgress` et l'ordre de
   * `rankStartedPaths`, deux fonctions pures déjà testées : ce service ne fait
   * que réunir les données.
   */
  async findStarted(userId: string, limit = 3) {
    const paths = await this.prisma.learningPath.findMany({
      where: {
        ...PUBLISHED_PATHS_WHERE,
        steps: {
          some: {
            entry: {
              published: true,
              OR: [
                { reads: { some: { userId } } },
                { quizAttempts: { some: { userId, score: { not: null } } } },
              ],
            },
          },
        },
      },
      orderBy: PUBLISHED_PATHS_ORDER,
      select: {
        id: true,
        name: true,
        slug: true,
        modules: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            steps: {
              where: VISIBLE_STEP_WHERE,
              orderBy: { position: 'asc' },
              select: {
                id: true,
                entryId: true,
                optional: true,
                entry: { select: { slug: true, title: true } },
              },
            },
          },
        },
      },
    });

    if (paths.length === 0) {
      return { items: [], total: 0 };
    }

    const entryIds = [
      ...new Set(
        paths.flatMap((path) =>
          path.modules.flatMap((module) => module.steps.map((step) => step.entryId)),
        ),
      ),
    ];

    const [reads, attempts, validated] = await Promise.all([
      this.prisma.entryRead.findMany({
        where: { userId, entryId: { in: entryIds } },
        select: { entryId: true, lastReadAt: true },
      }),
      this.prisma.quizAttempt.groupBy({
        by: ['entryId'],
        where: { userId, entryId: { in: entryIds }, score: { not: null } },
        _max: { createdAt: true },
      }),
      this.validatedEntryIds(userId, entryIds),
    ]);

    // Par fiche, la date la plus récente entre la lecture et l'examen terminé.
    const activityByEntry = new Map<string, Date>();
    const keepLatest = (entryId: string, date: Date | null) => {
      const known = activityByEntry.get(entryId);
      if (date && (!known || date.getTime() > known.getTime())) {
        activityByEntry.set(entryId, date);
      }
    };
    for (const read of reads) {
      keepLatest(read.entryId, read.lastReadAt);
    }
    for (const attempt of attempts) {
      keepLatest(attempt.entryId, attempt._max.createdAt);
    }

    const candidates = paths.map((path) => {
      const modules = path.modules.filter((module) => module.steps.length > 0);
      const steps = modules.flatMap((module) => module.steps);
      const progress = computePathProgress(modules, validated);
      const next = steps.find((step) => step.id === progress.nextStepId);

      return {
        pathId: path.id,
        slug: path.slug,
        name: path.name,
        required: progress.required,
        validatedRequired: progress.validatedRequired,
        completed: progress.completed,
        nextStep: next ? { entrySlug: next.entry.slug, title: next.entry.title } : null,
        lastActivityAt: lastActivity(
          steps.map((step) => step.entryId),
          activityByEntry,
        ),
      };
    });

    const started = rankStartedPaths(candidates, candidates.length);

    return { items: started.slice(0, Math.max(0, limit)), total: started.length };
  }
}
