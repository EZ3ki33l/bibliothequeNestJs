import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuizzesService } from './quizzes.service';
import { Prisma } from '../generated/prisma/client';
import { QUIZ_GENERATOR } from './quiz-generator';
import { PASSING_SCORE } from '../common/quiz-eligibility';
import { MAX_QUIZ_STARTS_PER_HOUR, QUIZ_QUOTA_WINDOW_MS } from '../common/quiz-quota';
import { VERIFIED_EMAIL_REQUIRED } from '../common/free-access';
import { EntryAccessService } from '../entry-access/entry-access.service';

const userId = 'user-1';
/** Utilisateur de la session : adresse vérifiée, sauf mention contraire. */
const user = { id: userId, emailVerified: true };
const unverifiedUser = { id: userId, emailVerified: false };
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
  entryId,
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
    entryId: true,
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
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const generator = {
    generate: jest.fn(),
  };
  const entryAccess = { assertReadable: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Par défaut, le compte n'a démarré aucun examen dans l'heure.
    prisma.quizAttempt.findMany.mockResolvedValue([]);
    // Par défaut, la fiche est lisible par le compte.
    entryAccess.assertReadable.mockReset().mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizzesService,
        { provide: PrismaService, useValue: prisma },
        { provide: QUIZ_GENERATOR, useValue: generator },
        { provide: EntryAccessService, useValue: entryAccess },
      ],
    }).compile();
    service = module.get(QuizzesService);
  });

  describe('start', () => {
    it('throws NotFoundException for an unknown entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.start(user, slug)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.entry.findFirst).toHaveBeenCalledWith(startSelect);
      expect(generator.generate).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unpublished entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.start(user, slug)).rejects.toBeInstanceOf(NotFoundException);
      expect(generator.generate).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('returns attempt null without insert when the body is too short', async () => {
      prisma.entry.findFirst.mockResolvedValue({
        ...publishedEntry,
        bodyMdx: 'x'.repeat(79),
      });
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.start(user, slug)).resolves.toEqual({
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

      await expect(service.start(user, slug)).resolves.toEqual({
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

      const result = await service.start(user, slug);

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

      await expect(service.start(user, slug)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException without insert when generate returns invalid questions', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      generator.generate.mockResolvedValue([
        { id: 'q1', prompt: '?', choices: ['seul'], correctIndex: 0 },
      ]);

      await expect(service.start(user, slug)).rejects.toBeInstanceOf(ServiceUnavailableException);
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

      const result = await service.start(user, slug);

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

  describe('start : plafond d’examens', () => {
    const now = new Date('2026-10-06T20:00:00.000Z');

    /** `count` tentatives du compte, une par minute, la plus récente d'abord. */
    function recentAttempts(count: number, oldestMinutesAgo: number) {
      return Array.from({ length: count }, (_, rank) => ({
        createdAt: new Date(now.getTime() - (oldestMinutesAgo - rank) * 60_000),
      })).reverse();
    }

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('counts the attempts of the caller alone, inside the window, bounded to the cap', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      generator.generate.mockResolvedValue(quizQuestions);
      prisma.quizAttempt.create.mockResolvedValue({ id: 'attempt-1' });

      await service.start(user, slug);

      expect(prisma.quizAttempt.findMany).toHaveBeenCalledWith({
        where: { userId, createdAt: { gt: new Date(now.getTime() - QUIZ_QUOTA_WINDOW_MS) } },
        orderBy: { createdAt: 'desc' },
        take: MAX_QUIZ_STARTS_PER_HOUR,
        select: { createdAt: true },
      });
    });

    it('still starts under the cap', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      prisma.quizAttempt.findMany.mockResolvedValue(
        recentAttempts(MAX_QUIZ_STARTS_PER_HOUR - 1, 30),
      );
      generator.generate.mockResolvedValue(quizQuestions);
      prisma.quizAttempt.create.mockResolvedValue({ id: 'attempt-1' });

      await expect(service.start(user, slug)).resolves.toMatchObject({
        attempt: { id: 'attempt-1' },
      });
    });

    it('refuses at the cap with 429 and retryAt, without generating nor inserting', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      prisma.quizAttempt.findMany.mockResolvedValue(recentAttempts(MAX_QUIZ_STARTS_PER_HOUR, 45));

      const error: unknown = await service.start(user, slug).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      const exception = error as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(exception.getResponse()).toEqual({
        statusCode: 429,
        message: 'Trop d’examens démarrés. Un nouvel essai sera possible plus tard.',
        // La plus ancienne des dix tentatives sort de la fenêtre dans 15 minutes.
        retryAt: '2026-10-06T20:15:00.000Z',
      });
      // Le refus arrive avant l'appel payant au modèle.
      expect(generator.generate).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('resumes an in-progress attempt above the cap, without counting', async () => {
      prisma.entry.findFirst.mockResolvedValue(publishedEntry);
      prisma.quizAttempt.findFirst.mockResolvedValue({
        id: 'attempt-open',
        questions: quizQuestions,
        score: null,
        answers: null,
      });
      prisma.quizAttempt.findMany.mockResolvedValue(recentAttempts(MAX_QUIZ_STARTS_PER_HOUR, 45));

      await expect(service.start(user, slug)).resolves.toMatchObject({
        attempt: { id: 'attempt-open' },
      });
      expect(prisma.quizAttempt.findMany).not.toHaveBeenCalled();
    });

    it('answers « no quiz » for a short entry above the cap : nothing would be generated', async () => {
      prisma.entry.findFirst.mockResolvedValue({ ...publishedEntry, bodyMdx: 'court' });
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      prisma.quizAttempt.findMany.mockResolvedValue(recentAttempts(MAX_QUIZ_STARTS_PER_HOUR, 45));

      await expect(service.start(user, slug)).resolves.toMatchObject({ attempt: null });
    });
  });

  describe('accès réservé', () => {
    /** La règle d'accès refuse : fiche réservée, adresse non vérifiée. */
    function refuseReading() {
      entryAccess.assertReadable.mockRejectedValue(new ForbiddenException(VERIFIED_EMAIL_REQUIRED));
    }

    describe('start', () => {
      it('refuses a reserved entry to an unverified account : nothing generated nor created', async () => {
        prisma.entry.findFirst.mockResolvedValue(publishedEntry);
        refuseReading();

        const error: unknown = await service
          .start(unverifiedUser, slug)
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe(VERIFIED_EMAIL_REQUIRED);
        expect(entryAccess.assertReadable).toHaveBeenCalledWith(entryId, false);
        expect(generator.generate).not.toHaveBeenCalled();
        expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
      });

      it('does not resume an attempt in progress on an entry closed since', async () => {
        prisma.entry.findFirst.mockResolvedValue(publishedEntry);
        prisma.quizAttempt.findFirst.mockResolvedValue({
          id: 'attempt-open',
          questions: quizQuestions,
          score: null,
          answers: null,
        });
        refuseReading();

        await expect(service.start(unverifiedUser, slug)).rejects.toBeInstanceOf(
          ForbiddenException,
        );

        // Le refus passe avant la reprise : la tentative n'est même pas lue.
        expect(prisma.quizAttempt.findFirst).not.toHaveBeenCalled();
        expect(prisma.quizAttempt.findMany).not.toHaveBeenCalled();
      });

      it('answers 404 for a draft before the access rule', async () => {
        prisma.entry.findFirst.mockResolvedValue(null);
        refuseReading();

        await expect(service.start(unverifiedUser, slug)).rejects.toBeInstanceOf(NotFoundException);
        expect(entryAccess.assertReadable).not.toHaveBeenCalled();
      });

      it('starts as before for an unverified account on a free entry', async () => {
        prisma.entry.findFirst.mockResolvedValue(publishedEntry);
        prisma.quizAttempt.findFirst.mockResolvedValue(null);
        generator.generate.mockResolvedValue(quizQuestions);
        prisma.quizAttempt.create.mockResolvedValue({ id: 'attempt-new' });

        await expect(service.start(unverifiedUser, slug)).resolves.toMatchObject({
          attempt: { id: 'attempt-new', questions: publicQuestions },
        });
        expect(entryAccess.assertReadable).toHaveBeenCalledWith(entryId, false);
      });

      it('passes the verified state of the session to the access rule', async () => {
        prisma.entry.findFirst.mockResolvedValue(publishedEntry);
        prisma.quizAttempt.findFirst.mockResolvedValue(null);
        generator.generate.mockResolvedValue(quizQuestions);
        prisma.quizAttempt.create.mockResolvedValue({ id: 'attempt-new' });

        await expect(service.start(user, slug)).resolves.toMatchObject({
          attempt: { id: 'attempt-new' },
        });
        expect(entryAccess.assertReadable).toHaveBeenCalledWith(entryId, true);
      });

      it('lets a failure of the access rule through, without generating', async () => {
        prisma.entry.findFirst.mockResolvedValue(publishedEntry);
        entryAccess.assertReadable.mockRejectedValue(new Error('connexion perdue'));

        await expect(service.start(unverifiedUser, slug)).rejects.toThrow('connexion perdue');
        expect(generator.generate).not.toHaveBeenCalled();
        expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
      });
    });

    describe('submit', () => {
      it('refuses to score an attempt on an entry the account cannot read', async () => {
        prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);
        refuseReading();

        await expect(service.submit(unverifiedUser, attemptId, allCorrect)).rejects.toBeInstanceOf(
          ForbiddenException,
        );

        expect(entryAccess.assertReadable).toHaveBeenCalledWith(entryId, false);
        // Aucun corrigé ne sort, la tentative reste en cours.
        expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
      });

      it('refuses before reading the answers : a malformed body is still a 403', async () => {
        prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);
        refuseReading();

        await expect(service.submit(unverifiedUser, attemptId, [])).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      });

      it('answers 404 for an unknown attempt before the access rule', async () => {
        prisma.quizAttempt.findFirst.mockResolvedValue(null);
        refuseReading();

        await expect(service.submit(unverifiedUser, attemptId, allCorrect)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(entryAccess.assertReadable).not.toHaveBeenCalled();
      });

      it('scores as before for an unverified account on a free entry', async () => {
        prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);
        prisma.quizAttempt.update.mockResolvedValue({});

        await expect(service.submit(unverifiedUser, attemptId, allCorrect)).resolves.toMatchObject({
          score: 100,
          passed: true,
        });
        expect(entryAccess.assertReadable).toHaveBeenCalledWith(entryId, false);
      });
    });
  });

  describe('submit', () => {
    it('throws NotFoundException for an unknown attempt', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.submit(user, attemptId, allCorrect)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.quizAttempt.findFirst).toHaveBeenCalledWith(submitWhere);
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for another user’s attempt', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.submit({ id: 'other-user', emailVerified: true }, attemptId, allCorrect),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the attempt is already scored', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.submit(user, attemptId, allCorrect)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the entry is unpublished', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(service.submit(user, attemptId, allCorrect)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.quizAttempt.findFirst).toHaveBeenCalledWith(submitWhere);
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when answers are incomplete', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);

      await expect(
        service.submit(user, attemptId, [{ questionId: 'q-usestate-1', choiceIndex: 0 }]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.quizAttempt.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a questionId is unknown', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);

      await expect(
        service.submit(user, attemptId, [
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

      const result = await service.submit(user, attemptId, mixed);

      expect(prisma.quizAttempt.update).toHaveBeenCalledWith({
        where: { id: attemptId },
        data: { answers: mixed, score: 50 },
      });
      expect(result).toEqual({
        id: attemptId,
        score: 50,
        passed: false,
        passingScore: PASSING_SCORE,
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

    /** Tentative de `total` questions dont la bonne réponse est toujours la première. */
    function attemptOf(total: number) {
      return {
        ...inProgressAttempt,
        questions: Array.from({ length: total }, (_, rank) => ({
          id: `q-${rank}`,
          prompt: `Question ${rank}`,
          choices: ['juste', 'fausse'],
          correctIndex: 0,
        })),
      };
    }

    /** `correct` bonnes réponses, puis des mauvaises. */
    function answersOf(total: number, correct: number) {
      return Array.from({ length: total }, (_, rank) => ({
        questionId: `q-${rank}`,
        choiceIndex: rank < correct ? 0 : 1,
      }));
    }

    it('passes exactly at the passing score', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(attemptOf(10));
      prisma.quizAttempt.update.mockResolvedValue({});

      const result = await service.submit(user, attemptId, answersOf(10, 7));

      expect(result).toMatchObject({ score: 70, passed: true, passingScore: PASSING_SCORE });
    });

    it('does not pass one point under the passing score', async () => {
      // 9 bonnes réponses sur 13 : 69,2 %, arrondi à 69.
      prisma.quizAttempt.findFirst.mockResolvedValue(attemptOf(13));
      prisma.quizAttempt.update.mockResolvedValue({});

      const result = await service.submit(user, attemptId, answersOf(13, 9));

      expect(result).toMatchObject({ score: 69, passed: false, passingScore: PASSING_SCORE });
    });

    it('passes a perfect score', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(inProgressAttempt);
      prisma.quizAttempt.update.mockResolvedValue({});

      await expect(service.submit(user, attemptId, allCorrect)).resolves.toMatchObject({
        score: 100,
        passed: true,
      });
    });
  });
});
