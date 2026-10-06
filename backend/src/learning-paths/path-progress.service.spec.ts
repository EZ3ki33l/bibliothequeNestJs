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
    quizAttempt: { findMany: jest.fn() },
    reviewCard: { findMany: jest.fn() },
    entry: { findMany: jest.fn() },
    learningPath: { findMany: jest.fn(), count: jest.fn() },
  };
  const learningPaths = { findPublishedBySlug: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.quizAttempt.findMany.mockResolvedValue([]);
    prisma.reviewCard.findMany.mockResolvedValue([]);
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

    it('only checks review cards for entries without a passed quiz', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([{ entryId: 'e1' }]);

      await service.validatedEntryIds(userId, ['e1', 'e2']);

      expect(prisma.reviewCard.findMany).toHaveBeenCalledWith({
        where: { userId, entryId: { in: ['e2'] } },
        select: { entryId: true },
      });
    });

    it('skips the card lookup when everything is already validated', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([{ entryId: 'e1' }]);

      await service.validatedEntryIds(userId, ['e1']);

      expect(prisma.reviewCard.findMany).not.toHaveBeenCalled();
    });

    it('validates a short entry once opened, but not a long one', async () => {
      prisma.reviewCard.findMany.mockResolvedValue([{ entryId: 'short' }, { entryId: 'long' }]);
      prisma.entry.findMany.mockResolvedValue([
        { id: 'short', bodyMdx: shortBody },
        { id: 'long', bodyMdx: longBody },
      ]);

      const result = await service.validatedEntryIds(userId, ['short', 'long']);

      expect(result).toEqual(new Set(['short']));
    });

    it('reads bodies only for candidates (card present, no passed quiz)', async () => {
      prisma.reviewCard.findMany.mockResolvedValue([{ entryId: 'e2' }]);

      await service.validatedEntryIds(userId, ['e1', 'e2', 'e3']);

      expect(prisma.entry.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['e2'] } },
        select: { id: true, bodyMdx: true },
      });
    });

    it('does not read bodies when no card exists', async () => {
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
});
