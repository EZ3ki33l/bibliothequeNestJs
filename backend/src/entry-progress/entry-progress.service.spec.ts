import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { PASSING_SCORE } from '../common/quiz-eligibility';
import { VERIFIED_EMAIL_REQUIRED } from '../common/free-access';
import { EntryAccessService } from '../entry-access/entry-access.service';
import { EntryProgressService } from './entry-progress.service';

const userId = 'user-1';
/** Utilisateur de la session : adresse vérifiée, sauf mention contraire. */
const user = { id: userId, emailVerified: true };
const unverifiedUser = { id: userId, emailVerified: false };
const entryId = 'entry-1';

/** Vraie erreur Prisma, pour tester la branche `catch` sans base de données. */
function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

describe('EntryProgressService', () => {
  let service: EntryProgressService;
  const prisma = {
    entry: { findFirst: jest.fn(), findMany: jest.fn() },
    entryRead: { upsert: jest.fn(), findMany: jest.fn() },
    quizAttempt: { groupBy: jest.fn() },
    favorite: { findMany: jest.fn() },
  };
  const entryAccess = { assertReadable: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    // Par défaut, la fiche est lisible par le compte.
    entryAccess.assertReadable.mockResolvedValue(undefined);
    prisma.entry.findMany.mockResolvedValue([]);
    prisma.entryRead.findMany.mockResolvedValue([]);
    prisma.quizAttempt.groupBy.mockResolvedValue([]);
    prisma.favorite.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntryProgressService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntryAccessService, useValue: entryAccess },
      ],
    }).compile();
    service = module.get(EntryProgressService);
  });

  describe('markRead', () => {
    it('upserts the read for the caller on a published entry', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });

      await expect(service.markRead(user, entryId)).resolves.toBeUndefined();

      expect(prisma.entry.findFirst).toHaveBeenCalledWith({
        where: { id: entryId, published: true },
        select: { id: true },
      });

      const call = prisma.entryRead.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId_entryId: { userId, entryId } });
      expect(call.create).toEqual({
        userId,
        entryId,
        createdAt: expect.any(Date),
        lastReadAt: expect.any(Date),
      });
      // Rouvrir la fiche n'avance que la date de dernière lecture.
      expect(call.update).toEqual({ lastReadAt: expect.any(Date) });
    });

    it('throws NotFoundException without writing for an unknown or unpublished entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.markRead(user, entryId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.entryRead.upsert).not.toHaveBeenCalled();
    });

    it('ignores the unique violation of two simultaneous requests', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      prisma.entryRead.upsert.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.markRead(user, entryId)).resolves.toBeUndefined();
    });

    it('rethrows any other error', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      prisma.entryRead.upsert.mockRejectedValue(new Error('connexion perdue'));

      await expect(service.markRead(user, entryId)).rejects.toThrow('connexion perdue');
    });

    it('refuses a reserved entry to an unverified account, without writing', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      entryAccess.assertReadable.mockRejectedValue(new ForbiddenException(VERIFIED_EMAIL_REQUIRED));

      const error: unknown = await service
        .markRead(unverifiedUser, entryId)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toBe(VERIFIED_EMAIL_REQUIRED);
      expect(entryAccess.assertReadable).toHaveBeenCalledWith(entryId, false);
      // Ouvrir la page floutée ne valide aucune étape de parcours.
      expect(prisma.entryRead.upsert).not.toHaveBeenCalled();
    });

    it('answers 404 for a draft before the access rule', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);
      entryAccess.assertReadable.mockRejectedValue(new ForbiddenException());

      await expect(service.markRead(unverifiedUser, entryId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(entryAccess.assertReadable).not.toHaveBeenCalled();
    });

    it('writes the read of an unverified account on a free entry', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });

      await expect(service.markRead(unverifiedUser, entryId)).resolves.toBeUndefined();

      expect(entryAccess.assertReadable).toHaveBeenCalledWith(entryId, false);
      expect(prisma.entryRead.upsert).toHaveBeenCalledTimes(1);
    });

    it('lets a failure of the access rule through, without writing', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      entryAccess.assertReadable.mockRejectedValue(new Error('connexion perdue'));

      await expect(service.markRead(unverifiedUser, entryId)).rejects.toThrow('connexion perdue');
      expect(prisma.entryRead.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findStates', () => {
    it('answers the passing score and no item without touching account data when nothing is published', async () => {
      await expect(service.findStates(userId, ['draft'])).resolves.toEqual({
        passingScore: PASSING_SCORE,
        items: [],
      });

      expect(prisma.entryRead.findMany).not.toHaveBeenCalled();
      expect(prisma.quizAttempt.groupBy).not.toHaveBeenCalled();
      expect(prisma.favorite.findMany).not.toHaveBeenCalled();
    });

    it('keeps published entries only, each looked up once', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }]);

      const result = await service.findStates(userId, ['e1', 'e1', 'draft']);

      expect(prisma.entry.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['e1', 'draft'] }, published: true },
        select: { id: true },
      });
      // Le brouillon est omis, sans erreur : son existence n'est pas confirmée.
      expect(result.items.map((item) => item.entryId)).toEqual(['e1']);
    });

    it('returns an item for a published entry the account never touched', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }]);

      await expect(service.findStates(userId, ['e1'])).resolves.toEqual({
        passingScore: PASSING_SCORE,
        items: [{ entryId: 'e1', read: false, bestScore: null, passed: false, favorite: false }],
      });
    });

    it('marks an entry read without a quiz', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }]);
      prisma.entryRead.findMany.mockResolvedValue([{ entryId: 'e1' }]);

      const { items } = await service.findStates(userId, ['e1']);

      expect(items).toEqual([
        { entryId: 'e1', read: true, bestScore: null, passed: false, favorite: false },
      ]);
    });

    it('passes at or above the passing score, on the best score', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]);
      prisma.quizAttempt.groupBy.mockResolvedValue([
        { entryId: 'e1', _max: { score: 80 } },
        { entryId: 'e2', _max: { score: 50 } },
        { entryId: 'e3', _max: { score: PASSING_SCORE } },
      ]);

      const { items } = await service.findStates(userId, ['e1', 'e2', 'e3']);

      expect(
        items.map(({ entryId, bestScore, passed }) => ({ entryId, bestScore, passed })),
      ).toEqual([
        { entryId: 'e1', bestScore: 80, passed: true },
        { entryId: 'e2', bestScore: 50, passed: false },
        { entryId: 'e3', bestScore: PASSING_SCORE, passed: true },
      ]);
    });

    it('ignores an attempt in progress (no score yet)', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }]);
      // Le filtre `score: { not: null }` écarte la tentative en base ; si un
      // groupe sans score sortait quand même, il ne vaudrait pas « réussi ».
      prisma.quizAttempt.groupBy.mockResolvedValue([{ entryId: 'e1', _max: { score: null } }]);

      const { items } = await service.findStates(userId, ['e1']);

      expect(prisma.quizAttempt.groupBy.mock.calls[0][0].where.score).toEqual({ not: null });
      expect(items[0]).toMatchObject({ bestScore: null, passed: false });
    });

    it('marks a favorite, alongside the other markers', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }]);
      prisma.entryRead.findMany.mockResolvedValue([{ entryId: 'e1' }]);
      prisma.favorite.findMany.mockResolvedValue([{ entryId: 'e1' }]);

      const { items } = await service.findStates(userId, ['e1']);

      expect(items[0]).toMatchObject({ read: true, favorite: true });
    });

    it('scopes every account read to the caller and to the published entries', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }]);

      await service.findStates(userId, ['e1', 'draft']);

      expect(prisma.entryRead.findMany).toHaveBeenCalledWith({
        where: { userId, entryId: { in: ['e1'] } },
        select: { entryId: true },
      });
      expect(prisma.quizAttempt.groupBy).toHaveBeenCalledWith({
        by: ['entryId'],
        where: { userId, entryId: { in: ['e1'] }, score: { not: null } },
        _max: { score: true },
      });
      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId, entryId: { in: ['e1'] } },
        select: { entryId: true },
      });
    });
  });
});
