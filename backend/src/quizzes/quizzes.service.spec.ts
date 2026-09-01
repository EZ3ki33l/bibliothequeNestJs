import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuizzesService } from './quizzes.service';
import { Prisma } from '../generated/prisma/client';
import { QUIZ_GENERATOR } from './quiz-generator';

const userId = 'user-1';
const entryId = 'entry-1';
const slug = 'use-state-compteur';

const quizQuestions = [
  {
    id: 'q-usestate-1',
    prompt: 'À quoi sert useState ?',
    choices: [
      'Garder une valeur entre les rendus',
      'Remplacer tous les composants',
      'Appeler l’API au montage',
    ],
    correctIndex: 0,
  },
  {
    id: 'q-usestate-2',
    prompt: 'Comment mets-tu à jour un compteur ?',
    choices: ['setCount(count + 1)', 'setCount((c) => c + 1)', 'count = count + 1'],
    correctIndex: 1,
  },
];

const publishedEntry = {
  id: entryId,
  title: 'useState - compteur',
  slug,
  summary: "Le hook d'état le plus simple : un compteur cliquable",
  quizQuestions,
  bodyMdx: 'NE DOIT PAS FUITER',
};

const publicQuestions = [
  {
    id: 'q-usestate-1',
    prompt: 'À quoi sert useState ?',
    choices: [
      'Garder une valeur entre les rendus',
      'Remplacer tous les composants',
      'Appeler l’API au montage',
    ],
  },
  {
    id: 'q-usestate-2',
    prompt: 'Comment mets-tu à jour un compteur ?',
    choices: ['setCount(count + 1)', 'setCount((c) => c + 1)', 'count = count + 1'],
  },
];

const attemptId = 'attempt-1';

const inProgressAttempt = {
  id: attemptId,
  questions: quizQuestions,
  entry: {
    title: publishedEntry.title,
    slug,
    summary: publishedEntry.summary,
  },
};

const submitWhere = {
  where: {
    id: attemptId,
    userId,
    answers: { equals: Prisma.DbNull },
    score: null,
    entry: { published: true },
  },
  select: {
    id: true,
    questions: true,
    entry: {
      select: {
        title: true,
        slug: true,
        summary: true,
      },
    },
  },
};

const allCorrect = [
  { questionId: 'q-usestate-1', choiceIndex: 0 },
  { questionId: 'q-usestate-2', choiceIndex: 1 },
];

describe('QuizzesService', () => {
  let service: QuizzesService;
  const prisma = {
    entry: {
      findFirst: jest.fn(),
    },
    quizAttempt: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const generator = {
    generate: jest.fn,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizzesService,
        { provide: PrismaService, useValue: prisma },
        { provide: QUIZ_GENERATOR, useValue: generator },
      ],
    }).compile();
    service = module.get(QuizzesService);
  });

  describe('start', () => {
    it('throws NotFoundException for an unknown entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.start(userId, slug)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.entry.findFirst).toHaveBeenCalledWith({
        where: { slug, published: true },
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          quizQuestions: true,
        },
      });
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unpublished entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.start(userId, slug)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('returns attempt null without insert when the quiz is empty', async () => {
      prisma.entry.findFirst.mockResolvedValue({
        ...publishedEntry,
        quizQuestions: [],
      });

      await expect(service.start(userId, slug)).resolves.toEqual({
        attempt: null,
        entry: {
          title: publishedEntry.title,
          slug,
          summary: publishedEntry.summary,
        },
      });
      expect(prisma.quizAttempt.findFirst).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('returns attempt null without insert when the quiz is invalid', async () => {
      prisma.entry.findFirst.mockResolvedValue({
        ...publishedEntry,
        quizQuestions: [{ id: 'q1', prompt: '?', choices: ['seul'], correctIndex: 0 }],
      });

      await expect(service.start(userId, slug)).resolves.toEqual({
        attempt: null,
        entry: {
          title: publishedEntry.title,
          slug,
          summary: publishedEntry.summary,
        },
      });
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('creates a snapshot and omits correctIndex and bodyMdx', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      prisma.quizAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        questions: quizQuestions,
        score: null,
      });

      const result = await service.start(userId, slug);

      expect(prisma.quizAttempt.create).toHaveBeenCalledWith({
        data: { userId, entryId, questions: quizQuestions },
      });
      expect(result).toEqual({
        attempt: { id: 'attempt-1', score: null, questions: publicQuestions },
        entry: {
          title: publishedEntry.title,
          slug,
          summary: publishedEntry.summary,
        },
      });
      expect(JSON.stringify(result)).not.toContain('correctIndex');
      expect(JSON.stringify(result)).not.toContain('bodyMdx');
    });

    it('resumes the latest in-progress attempt', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue({
        id: 'attempt-open',
        questions: quizQuestions,
        score: null,
        answers: null,
      });

      await expect(service.start(userId, slug)).resolves.toEqual({
        attempt: { id: 'attempt-open', score: null, questions: publicQuestions },
        entry: {
          title: publishedEntry.title,
          slug,
          summary: publishedEntry.summary,
        },
      });
      expect(prisma.quizAttempt.findFirst).toHaveBeenCalledWith({
        where: { userId, entryId, answers: { equals: Prisma.DbNull }, score: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('creates a new row when the previous attempt is already scored', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      prisma.quizAttempt.create.mockResolvedValue({
        id: 'attempt-2',
        questions: quizQuestions,
        score: null,
      });

      await expect(service.start(userId, slug)).resolves.toMatchObject({
        attempt: { id: 'attempt-2' },
      });
      expect(prisma.quizAttempt.create).toHaveBeenCalled();
    });
  });
  describe('submit', () => {
    it('throws NotFoundException for an unknown attempt', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.submit(userId, attemptId, allCorrect)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.quizAttempt.findFirst).toHaveBeenCalledWith(submitWhere);
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for another user’s attempt', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.submit('other-user', attemptId, allCorrect)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the attempt is already scored', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.submit(userId, attemptId, allCorrect)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the entry is unpublished', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.submit(userId, attemptId, allCorrect)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.quizAttempt.findFirst).toHaveBeenCalledWith(submitWhere);
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when answers are incomplete', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);

      await expect(
        service.submit(userId, attemptId, [{ questionId: 'q-usestate-1', choiceIndex: 0 }]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a questionId is unknown', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);

      await expect(
        service.submit(userId, attemptId, [
          { questionId: 'inconnu', choiceIndex: 0 },
          { questionId: 'q-usestate-2', choiceIndex: 1 },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('persists answers and score without leaking correctIndex or bodyMdx', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);
      prisma.quizAttempt.update.mockResolvedValue({});

      const result = await service.submit(userId, attemptId, allCorrect);

      expect(prisma.quizAttempt.update).toHaveBeenCalledWith({
        where: { id: attemptId },
        data: { answers: allCorrect, score: 100 },
      });
      expect(result).toEqual({
        id: attemptId,
        score: 100,
        correctCount: 2,
        total: 2,
        entry: {
          title: publishedEntry.title,
          slug,
          summary: publishedEntry.summary,
        },
      });
      expect(JSON.stringify(result)).not.toContain('correctIndex');
      expect(JSON.stringify(result)).not.toContain('bodyMdx');
    });
  });
});
