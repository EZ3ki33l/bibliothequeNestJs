import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PathProgressService } from './path-progress.service';
import { LearningPathsService } from './learning-paths.service';
import { MIN_QUIZ_BODY_LENGTH, PASSING_SCORE } from '../common/quiz-eligibility';

const userId = 'user-1';
const shortBody = 'x'.repeat(MIN_QUIZ_BODY_LENGTH - 1);
const longBody = 'x'.repeat(MIN_QUIZ_BODY_LENGTH);

function publicPath() {
  return {
    id: 'path-1',
    name: 'Web',
    slug: 'web',
    description: '',
    modules: [
      {
        id: 'm1',
        title: 'Bases',
        description: '',
        steps: [
          { id: 's1', optional: false, entry: { id: 'e1' } },
          { id: 's2', optional: false, entry: { id: 'e2' } },
          { id: 's3', optional: true, entry: { id: 'e3' } },
        ],
      },
    ],
  };
}

describe('PathProgressService', () => {
  let service: PathProgressService;
  const prisma = {
    quizAttempt: { findMany: jest.fn(), groupBy: jest.fn() },
    entryRead: { findMany: jest.fn() },
    entry: { findMany: jest.fn() },
    learningPath: { findMany: jest.fn(), count: jest.fn() },
  };
  const learningPaths = { findPublishedBySlug: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.quizAttempt.findMany.mockResolvedValue([]);
    prisma.quizAttempt.groupBy.mockResolvedValue([]);
    prisma.entryRead.findMany.mockResolvedValue([]);
    prisma.entry.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PathProgressService,
        { provide: PrismaService, useValue: prisma },
        { provide: LearningPathsService, useValue: learningPaths },
      ],
    }).compile();
    service = module.get(PathProgressService);
  });

  describe('validatedEntryIds', () => {
    it('returns an empty set without querying when there is no entry', async () => {
      await expect(service.validatedEntryIds(userId, [])).resolves.toEqual(new Set());
      expect(prisma.quizAttempt.findMany).not.toHaveBeenCalled();
    });

    it('validates on a finished quiz at or above the passing score, scoped to the user', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([{ entryId: 'e1' }]);

      const result = await service.validatedEntryIds(userId, ['e1', 'e2']);

      expect(result).toEqual(new Set(['e1']));
      // `score: { gte }` exclut aussi les examens non terminés (`score: null`).
      expect(prisma.quizAttempt.findMany).toHaveBeenCalledWith({
        where: { userId, entryId: { in: ['e1', 'e2'] }, score: { gte: PASSING_SCORE } },
        select: { entryId: true },
        distinct: ['entryId'],
      });
    });

    it('only checks reads for entries without a passed quiz', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([{ entryId: 'e1' }]);

      await service.validatedEntryIds(userId, ['e1', 'e2']);

      expect(prisma.entryRead.findMany).toHaveBeenCalledWith({
        where: { userId, entryId: { in: ['e2'] } },
        select: { entryId: true },
      });
    });

    it('skips the read lookup when everything is already validated', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([{ entryId: 'e1' }]);

      await service.validatedEntryIds(userId, ['e1']);

      expect(prisma.entryRead.findMany).not.toHaveBeenCalled();
    });

    it('validates a short entry once read, but not a long one', async () => {
      prisma.entryRead.findMany.mockResolvedValue([{ entryId: 'short' }, { entryId: 'long' }]);
      prisma.entry.findMany.mockResolvedValue([
        { id: 'short', bodyMdx: shortBody },
        { id: 'long', bodyMdx: longBody },
      ]);

      const result = await service.validatedEntryIds(userId, ['short', 'long']);

      expect(result).toEqual(new Set(['short']));
    });

    it('reads bodies only for candidates (read present, no passed quiz)', async () => {
      prisma.entryRead.findMany.mockResolvedValue([{ entryId: 'e2' }]);

      await service.validatedEntryIds(userId, ['e1', 'e2', 'e3']);

      expect(prisma.entry.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['e2'] } },
        select: { id: true, bodyMdx: true },
      });
    });

    it('does not read bodies when no read exists', async () => {
      await service.validatedEntryIds(userId, ['e1']);

      expect(prisma.entry.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findForPath', () => {
    it('computes progress on the public (visible) structure', async () => {
      learningPaths.findPublishedBySlug.mockResolvedValue(publicPath());
      prisma.quizAttempt.findMany.mockResolvedValue([{ entryId: 'e2' }, { entryId: 'e3' }]);

      const result = await service.findForPath(userId, 'web');

      expect(learningPaths.findPublishedBySlug).toHaveBeenCalledWith('web');
      expect(result).toEqual({
        pathId: 'path-1',
        // Le seuil vient du serveur : la page ne le recopie pas.
        passingScore: PASSING_SCORE,
        validatedStepIds: ['s2', 's3'],
        required: 2,
        validatedRequired: 1,
        modules: [{ moduleId: 'm1', required: 2, validatedRequired: 1 }],
        nextStepId: 's1',
        completed: false,
      });
    });

    it('propagates the 404 of a draft or unknown path', async () => {
      learningPaths.findPublishedBySlug.mockRejectedValue(new NotFoundException());

      await expect(service.findForPath(userId, 'brouillon')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.quizAttempt.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findPage', () => {
    it('paginates the same published paths, in the same order, as the public list', async () => {
      prisma.learningPath.findMany.mockResolvedValue([]);
      prisma.learningPath.count.mockResolvedValue(0);

      await service.findPage(userId, 2, 10);

      const call = prisma.learningPath.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ published: true });
      expect(call.orderBy).toEqual([{ position: 'asc' }, { name: 'asc' }]);
      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
      expect(call.select.modules.select.steps.where).toEqual({ entry: { published: true } });
    });

    it('summarises each path with a single validation lookup', async () => {
      prisma.learningPath.findMany.mockResolvedValue([
        {
          id: 'p1',
          modules: [{ id: 'm1', steps: [{ id: 's1', entryId: 'e1', optional: false }] }],
        },
        {
          id: 'p2',
          modules: [
            {
              id: 'm2',
              steps: [
                { id: 's2', entryId: 'e1', optional: false },
                { id: 's3', entryId: 'e2', optional: false },
              ],
            },
          ],
        },
      ]);
      prisma.learningPath.count.mockResolvedValue(2);
      prisma.quizAttempt.findMany.mockResolvedValue([{ entryId: 'e1' }]);

      const result = await service.findPage(userId, 1, 50);

      expect(prisma.quizAttempt.findMany).toHaveBeenCalledTimes(1);
      // Une même fiche dans deux parcours n'est cherchée qu'une fois.
      expect(prisma.quizAttempt.findMany.mock.calls[0][0].where.entryId).toEqual({
        in: ['e1', 'e2'],
      });
      expect(result).toEqual({
        items: [
          { pathId: 'p1', required: 1, validatedRequired: 1, completed: true },
          { pathId: 'p2', required: 2, validatedRequired: 1, completed: false },
        ],
        total: 2,
        page: 1,
        limit: 50,
      });
    });
  });

  describe('findStarted', () => {
    /** Parcours tel que le renvoie la requête : modules, étapes visibles, fiche de chaque étape. */
    function startedPath(id: string, entryIds: string[]) {
      return {
        id,
        name: `Parcours ${id}`,
        slug: id,
        modules: [
          {
            id: `${id}-m1`,
            steps: entryIds.map((entryId) => ({
              id: `${id}-${entryId}`,
              entryId,
              optional: false,
              entry: { slug: `slug-${entryId}`, title: `Titre ${entryId}` },
            })),
          },
        ],
      };
    }

    function day(value: number): Date {
      return new Date(Date.UTC(2026, 9, value));
    }

    it('returns nothing, without reading account data, when no path is started', async () => {
      prisma.learningPath.findMany.mockResolvedValue([]);

      await expect(service.findStarted(userId)).resolves.toEqual({ items: [], total: 0 });
      expect(prisma.entryRead.findMany).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.groupBy).not.toHaveBeenCalled();
    });

    it('asks only for published paths the account started, on visible entries', async () => {
      prisma.learningPath.findMany.mockResolvedValue([]);

      await service.findStarted(userId);

      const call = prisma.learningPath.findMany.mock.calls[0][0];
      expect(call.where).toEqual({
        published: true,
        steps: {
          some: {
            entry: {
              published: true,
              OR: [
                { reads: { some: { userId } } },
                // Un examen en cours (`score: null`) ne fait pas commencer un parcours.
                { quizAttempts: { some: { userId, score: { not: null } } } },
              ],
            },
          },
        },
      });
      // Une étape dont la fiche est dépubliée ne sort pas.
      expect(call.select.modules.select.steps.where).toEqual({ entry: { published: true } });
    });

    it('describes a path started by a read alone, with its next step', async () => {
      prisma.learningPath.findMany.mockResolvedValue([startedPath('hooks', ['e1', 'e2'])]);
      prisma.entryRead.findMany.mockImplementation(({ select }: { select: object }) =>
        // Même simulacre pour `findStarted` (dates) et `validatedEntryIds`.
        Promise.resolve('lastReadAt' in select ? [{ entryId: 'e1', lastReadAt: day(3) }] : []),
      );

      await expect(service.findStarted(userId)).resolves.toEqual({
        items: [
          {
            pathId: 'hooks',
            slug: 'hooks',
            name: 'Parcours hooks',
            required: 2,
            validatedRequired: 0,
            completed: false,
            nextStep: { entrySlug: 'slug-e1', title: 'Titre e1' },
            lastActivityAt: day(3),
          },
        ],
        total: 1,
      });
    });

    it('reports a completed path without a next step', async () => {
      prisma.learningPath.findMany.mockResolvedValue([startedPath('court', ['e1'])]);
      prisma.quizAttempt.findMany.mockResolvedValue([{ entryId: 'e1' }]);
      prisma.quizAttempt.groupBy.mockResolvedValue([
        { entryId: 'e1', _max: { createdAt: day(4) } },
      ]);

      const { items } = await service.findStarted(userId);

      expect(items[0]).toMatchObject({
        required: 1,
        validatedRequired: 1,
        completed: true,
        nextStep: null,
        lastActivityAt: day(4),
      });
    });

    it('keeps the most recent of the read and the finished quiz of an entry', async () => {
      prisma.learningPath.findMany.mockResolvedValue([startedPath('hooks', ['e1'])]);
      prisma.entryRead.findMany.mockImplementation(({ select }: { select: object }) =>
        Promise.resolve('lastReadAt' in select ? [{ entryId: 'e1', lastReadAt: day(2) }] : []),
      );
      prisma.quizAttempt.groupBy.mockResolvedValue([
        { entryId: 'e1', _max: { createdAt: day(7) } },
      ]);

      const { items } = await service.findStarted(userId);

      expect(items[0].lastActivityAt).toEqual(day(7));
    });

    it('returns three of four started paths, most recent first, with the real total', async () => {
      prisma.learningPath.findMany.mockResolvedValue([
        startedPath('a', ['ea']),
        startedPath('b', ['eb']),
        startedPath('c', ['ec']),
        startedPath('d', ['ed']),
      ]);
      prisma.entryRead.findMany.mockImplementation(({ select }: { select: object }) =>
        Promise.resolve(
          'lastReadAt' in select
            ? [
                { entryId: 'ea', lastReadAt: day(1) },
                { entryId: 'eb', lastReadAt: day(4) },
                { entryId: 'ec', lastReadAt: day(2) },
                { entryId: 'ed', lastReadAt: day(3) },
              ]
            : [],
        ),
      );

      const result = await service.findStarted(userId);

      expect(result.items.map((item) => item.pathId)).toEqual(['b', 'd', 'c']);
      expect(result.total).toBe(4);
    });

    it('honours a custom limit', async () => {
      prisma.learningPath.findMany.mockResolvedValue([
        startedPath('a', ['ea']),
        startedPath('b', ['eb']),
      ]);
      prisma.entryRead.findMany.mockImplementation(({ select }: { select: object }) =>
        Promise.resolve(
          'lastReadAt' in select
            ? [
                { entryId: 'ea', lastReadAt: day(1) },
                { entryId: 'eb', lastReadAt: day(2) },
              ]
            : [],
        ),
      );

      const result = await service.findStarted(userId, 1);

      expect(result.items.map((item) => item.pathId)).toEqual(['b']);
      expect(result.total).toBe(2);
    });

    it('drops an empty module and a path whose only activity was on an unpublished entry', async () => {
      // La requête ne renvoie que les étapes visibles : la fiche dépubliée
      // n'apparaît plus, le parcours n'a donc aucune activité à montrer.
      prisma.learningPath.findMany.mockResolvedValue([
        {
          ...startedPath('vide', []),
          modules: [{ id: 'vide-m1', steps: [] }],
        },
      ]);

      await expect(service.findStarted(userId)).resolves.toEqual({ items: [], total: 0 });
    });

    it('scopes every account read to the caller', async () => {
      prisma.learningPath.findMany.mockResolvedValue([startedPath('hooks', ['e1', 'e1b'])]);

      await service.findStarted(userId);

      expect(prisma.entryRead.findMany).toHaveBeenCalledWith({
        where: { userId, entryId: { in: ['e1', 'e1b'] } },
        select: { entryId: true, lastReadAt: true },
      });
      expect(prisma.quizAttempt.groupBy).toHaveBeenCalledWith({
        by: ['entryId'],
        where: { userId, entryId: { in: ['e1', 'e1b'] }, score: { not: null } },
        _max: { createdAt: true },
      });
      // `validatedEntryIds` : examens réussis du même compte.
      expect(prisma.quizAttempt.findMany.mock.calls[0][0].where.userId).toBe(userId);
    });
  });
});
