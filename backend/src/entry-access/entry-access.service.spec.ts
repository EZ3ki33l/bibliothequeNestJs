import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VERIFIED_EMAIL_REQUIRED } from '../common/free-access';
import { EntryAccessService } from './entry-access.service';

/** Parcours de démonstration : trois fiches libres, puis quatre réservées. */
const demoPath = {
  modules: [
    { steps: [{ entryId: 'e1' }, { entryId: 'e2' }, { entryId: 'e3' }] },
    { steps: [{ entryId: 'e4' }, { entryId: 'e5' }, { entryId: 'e6' }, { entryId: 'e7' }] },
  ],
};

describe('EntryAccessService', () => {
  let service: EntryAccessService;
  const prisma = {
    learningPath: { findMany: jest.fn() },
    entry: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.learningPath.findMany.mockResolvedValue([demoPath]);
    prisma.entry.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [EntryAccessService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(EntryAccessService);
  });

  describe('freeEntryIds', () => {
    it('reads published paths, modules in order, visible steps, entry ids only', async () => {
      await service.freeEntryIds();

      expect(prisma.learningPath.findMany).toHaveBeenCalledWith({
        where: { published: true },
        select: {
          modules: {
            orderBy: { position: 'asc' },
            select: {
              steps: { where: { entry: { published: true } }, select: { entryId: true } },
            },
          },
        },
      });
    });

    it('returns the entries of the first visible module of each path', async () => {
      const ids = await service.freeEntryIds();

      expect([...ids].sort()).toEqual(['e1', 'e2', 'e3']);
    });

    it('returns nothing without published path', async () => {
      prisma.learningPath.findMany.mockResolvedValue([]);

      await expect(service.freeEntryIds()).resolves.toEqual(new Set());
    });

    it('lets a database error through', async () => {
      prisma.learningPath.findMany.mockRejectedValue(new Error('connexion perdue'));

      await expect(service.freeEntryIds()).rejects.toThrow('connexion perdue');
    });
  });

  describe('isFree', () => {
    it('is true for an entry of the first module', async () => {
      await expect(service.isFree('e2')).resolves.toBe(true);
    });

    it('is false for an entry of a later module, or outside every path', async () => {
      await expect(service.isFree('e4')).resolves.toBe(false);
      await expect(service.isFree('hors-parcours')).resolves.toBe(false);
    });

    it('lets a database error through instead of answering « free »', async () => {
      prisma.learningPath.findMany.mockRejectedValue(new Error('connexion perdue'));

      await expect(service.isFree('e1')).rejects.toThrow('connexion perdue');
    });
  });

  describe('assertReadable', () => {
    it('lets a verified account read anything, without any query', async () => {
      await expect(service.assertReadable('e4', true)).resolves.toBeUndefined();

      expect(prisma.learningPath.findMany).not.toHaveBeenCalled();
    });

    it('lets an unverified account read a free entry', async () => {
      await expect(service.assertReadable('e1', false)).resolves.toBeUndefined();
    });

    it('refuses a reserved entry to an unverified account, with the French message', async () => {
      const error: unknown = await service
        .assertReadable('e4', false)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toBe(VERIFIED_EMAIL_REQUIRED);
    });

    it.each([undefined, null, 'true', 1, {}])(
      'treats %p as unverified : only the boolean true opens the catalogue',
      async (emailVerified) => {
        await expect(service.assertReadable('e4', emailVerified as boolean)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it('lets a database error through : the entry is never readable by default', async () => {
      prisma.learningPath.findMany.mockRejectedValue(new Error('connexion perdue'));

      await expect(service.assertReadable('e1', false)).rejects.toThrow('connexion perdue');
    });
  });

  describe('findAccess', () => {
    it('answers one item per published entry, free or not', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e4' }]);

      await expect(service.findAccess(['e1', 'e4'])).resolves.toEqual({
        items: [
          { entryId: 'e1', free: true },
          { entryId: 'e4', free: false },
        ],
      });
    });

    it('keeps published entries only, each looked up once', async () => {
      await service.findAccess(['e1', 'e1', 'brouillon']);

      expect(prisma.entry.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['e1', 'brouillon'] }, published: true },
        select: { id: true },
      });
    });

    it('omits a draft and an unknown id, without error', async () => {
      prisma.entry.findMany.mockResolvedValue([{ id: 'e1' }]);

      await expect(service.findAccess(['e1', 'brouillon', 'inconnu'])).resolves.toEqual({
        items: [{ entryId: 'e1', free: true }],
      });
    });

    it('lets a database error through, from either read', async () => {
      prisma.learningPath.findMany.mockRejectedValue(new Error('connexion perdue'));
      await expect(service.findAccess(['e1'])).rejects.toThrow('connexion perdue');

      prisma.learningPath.findMany.mockResolvedValue([demoPath]);
      prisma.entry.findMany.mockRejectedValue(new Error('délai dépassé'));
      await expect(service.findAccess(['e1'])).rejects.toThrow('délai dépassé');
    });
  });

  describe('summary', () => {
    it('counts the free entries', async () => {
      await expect(service.summary()).resolves.toEqual({ freeEntryCount: 3 });
    });

    it('answers 0 when no published path has a visible first module', async () => {
      prisma.learningPath.findMany.mockResolvedValue([{ modules: [{ steps: [] }] }]);

      await expect(service.summary()).resolves.toEqual({ freeEntryCount: 0 });
    });

    it('lets a database error through', async () => {
      prisma.learningPath.findMany.mockRejectedValue(new Error('connexion perdue'));

      await expect(service.summary()).rejects.toThrow('connexion perdue');
    });
  });
});
