import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  bodyMdx: `${'x'.repeat(80)} NE DOIT PAS FUITER`,
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

const startSelect = {
  where: { slug, published: true },
  select: {
    id: true,
    title: true,
    slug: true,
    summary: true,
    bodyMdx: true,
  },
};

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
    generate: jest.fn(),
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
      expect(prisma.entry.findFirst).toHaveBeenCalledWith(startSelect);
      expect(generator.generate).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unpublished entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.start(userId, slug)).rejects.toBeInstanceOf(NotFoundException);
      expect(generator.generate).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('returns attempt null without insert when the body is too short', async () => {
      prisma.entry.findFirst.mockResolvedValue({
        ...publishedEntry,
        bodyMdx: 'x'.repeat(79),
      });
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.start(userId, slug)).resolves.toEqual({
        attempt: null,
        entry: {
          title: publishedEntry.title,
          slug,
          summary: publishedEntry.summary,
        },
      });
      expect(generator.generate).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('resumes the latest in-progress attempt without calling generate', async () => {
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
      expect(generator.generate).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('creates a snapshot from generate and omits correctIndex and bodyMdx', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      generator.generate.mockResolvedValue(quizQuestions);
      prisma.quizAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        questions: quizQuestions,
        score: null,
      });

      const result = await service.start(userId, slug);

      expect(generator.generate).toHaveBeenCalledWith({
        title: publishedEntry.title,
        summary: publishedEntry.summary,
        bodyMdx: publishedEntry.bodyMdx,
      });
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

    it('throws ServiceUnavailableException without insert when generate returns null', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      generator.generate.mockResolvedValue(null);

      await expect(service.start(userId, slug)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException without insert when generate returns invalid questions', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      generator.generate.mockResolvedValue([
        { id: 'q1', prompt: '?', choices: ['seul'], correctIndex: 0 },
      ]);

      await expect(service.start(userId, slug)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('generates a new snapshot after a scored attempt, not the previous JSON', async () => {
      const generatedQuestions = [
        {
          id: 'q-retry-1',
          prompt: 'Que retourne useState ?',
          choices: ['Un tableau [valeur, setter]', 'Un objet unique', 'Un booléen'],
          correctIndex: 0,
        },
      ];

      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      // Tentative précédente notée : elle ne matche pas answers null + score null.
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      generator.generate.mockResolvedValue(generatedQuestions);
      prisma.quizAttempt.create.mockResolvedValue({
        id: 'attempt-2',
        questions: generatedQuestions,
        score: null,
      });

      const result = await service.start(userId, slug);

      expect(generator.generate).toHaveBeenCalledWith({
        title: publishedEntry.title,
        summary: publishedEntry.summary,
        bodyMdx: publishedEntry.bodyMdx,
      });
      expect(prisma.quizAttempt.create).toHaveBeenCalledWith({
        data: { userId, entryId, questions: generatedQuestions },
      });
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        attempt: {
          id: 'attempt-2',
          score: null,
          questions: [
            {
              id: 'q-retry-1',
              prompt: 'Que retourne useState ?',
              choices: ['Un tableau [valeur, setter]', 'Un objet unique', 'Un booléen'],
            },
          ],
        },
        entry: {
          title: publishedEntry.title,
          slug,
          summary: publishedEntry.summary,
        },
      });
      expect(JSON.stringify(result.attempt?.questions)).not.toContain('À quoi sert useState ?');
      expect(JSON.stringify(result)).not.toContain('correctIndex');
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

    it('returns recap with selectedChoice, correctChoice and correctIndex without bodyMdx', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);
      prisma.quizAttempt.update.mockResolvedValue({});

      const mixed = [
        { questionId: 'q-usestate-1', choiceIndex: 1 },
        { questionId: 'q-usestate-2', choiceIndex: 1 },
      ];

      const result = await service.submit(userId, attemptId, mixed);

      expect(prisma.quizAttempt.update).toHaveBeenCalledWith({
        where: { id: attemptId },
        data: { answers: mixed, score: 50 },
      });
      expect(result).toEqual({
        id: attemptId,
        score: 50,
        correctCount: 1,
        total: 2,
        questions: [
          {
            id: 'q-usestate-1',
            prompt: 'À quoi sert useState ?',
            choices: [
              'Garder une valeur entre les rendus',
              'Remplacer tous les composants',
              'Appeler l’API au montage',
            ],
            selectedIndex: 1,
            correctIndex: 0,
            selectedChoice: 'Remplacer tous les composants',
            correctChoice: 'Garder une valeur entre les rendus',
          },
          {
            id: 'q-usestate-2',
            prompt: 'Comment mets-tu à jour un compteur ?',
            choices: ['setCount(count + 1)', 'setCount((c) => c + 1)', 'count = count + 1'],
            selectedIndex: 1,
            correctIndex: 1,
            selectedChoice: 'setCount((c) => c + 1)',
            correctChoice: 'setCount((c) => c + 1)',
          },
        ],
        entry: {
          title: publishedEntry.title,
          slug,
          summary: publishedEntry.summary,
        },
      });
      expect(JSON.stringify(result)).not.toContain('bodyMdx');
    });
  });
});
