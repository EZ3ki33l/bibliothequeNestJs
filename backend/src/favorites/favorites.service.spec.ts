import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FavoritesService } from './favorites.service';
import { Prisma } from '../generated/prisma/client';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';

const userId = 'user-1';
const entryId = 'entry-1';

/**
 * Fabrique une vraie erreur Prisma « violation de contrainte unique » (code
 * `P2002`), pour tester la branche `catch` de `create` sans base de données.
 * Même helper que `reviews.service.spec.ts` (`ReviewsService.ensure`),
 * puisque la méthode reproduit exactement le même patron.
 */
function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

const favorite = {
  id: 'favorite-1',
  createdAt: new Date('2026-08-29T17:00:00.000Z'),
  entry: {
    id: entryId,
    title: 'useState',
    slug: 'useState',
    summary: 'Etat local',
    kind: 'FUNCTION',
    difficulty: 'BEGINNER',
    tags: [],
    category: null,
  },
};

describe('FavoritesService', () => {
  let service: FavoritesService;
  const prisma = {
    entry: {
      findFirst: jest.fn(),
    },
    favorite: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [FavoritesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(FavoritesService);
  });

  describe('findMany', () => {
    it('filters by userId and published entries', async () => {
      prisma.favorite.findMany.mockResolvedValue([favorite]);
      prisma.favorite.count.mockResolvedValue(1);

      await service.findMany(userId, { page: 1, limit: 50 });

      const where = { userId, entry: { published: true } };
      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
        where,
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, entry: { select: ENTRY_CARD_SELECT } },
      });
      expect(prisma.favorite.count).toHaveBeenCalledWith({ where });
    });

    it('ignores drafts via entry.published', async () => {
      prisma.favorite.findMany.mockResolvedValue([]);
      prisma.favorite.count.mockResolvedValue(0);

      await service.findMany(userId, { page: 1, limit: 50 });

      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entry: { published: true } }),
        }),
      );
    });

    it('narrows to a single entry when entryId is given', async () => {
      prisma.favorite.findMany.mockResolvedValue([favorite]);
      prisma.favorite.count.mockResolvedValue(1);

      await service.findMany(userId, { page: 1, limit: 50, entryId });

      const where = { userId, entry: { published: true }, entryId };
      expect(prisma.favorite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
      expect(prisma.favorite.count).toHaveBeenCalledWith({ where });
    });

    it('returns zero items for an entryId with no favorite', async () => {
      prisma.favorite.findMany.mockResolvedValue([]);
      prisma.favorite.count.mockResolvedValue(0);

      await expect(service.findMany(userId, { page: 1, limit: 50, entryId })).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
      });
    });

    it('returns a paginated envelope without bodyMdx', async () => {
      prisma.favorite.findMany.mockResolvedValue([favorite]);
      prisma.favorite.count.mockResolvedValue(1);

      await expect(service.findMany(userId, { page: 1, limit: 50 })).resolves.toEqual({
        items: [favorite],
        total: 1,
        page: 1,
        limit: 50,
      });
      expect(ENTRY_CARD_SELECT).not.toHaveProperty('bodyMdx');
      expect(ENTRY_CARD_SELECT).not.toHaveProperty('quizQuestions');
    });
  });

  describe('create', () => {
    const created = { id: 'favorite-1', entryId, createdAt: new Date('2026-09-11T10:00:00.000Z') };

    it('creates a favorite for a published entry', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      prisma.favorite.create.mockResolvedValue(created);

      await expect(service.create(userId, entryId)).resolves.toEqual({
        ...created,
        created: true,
      });
      expect(prisma.entry.findFirst).toHaveBeenCalledWith({
        where: { id: entryId, published: true },
        select: { id: true },
      });
      expect(prisma.favorite.create).toHaveBeenCalledWith({
        data: { userId, entryId },
        select: { id: true, entryId: true, createdAt: true },
      });
    });

    it('throws NotFoundException for a draft entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, entryId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.favorite.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, entryId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.favorite.create).not.toHaveBeenCalled();
    });

    it('treats a concurrent P2002 as already favorited, not an error', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      prisma.favorite.create.mockRejectedValue(knownRequestError('P2002'));
      prisma.favorite.findUniqueOrThrow.mockResolvedValue(created);

      await expect(service.create(userId, entryId)).resolves.toEqual({
        ...created,
        created: false,
      });
      expect(prisma.favorite.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { userId_entryId: { userId, entryId } },
        select: { id: true, entryId: true, createdAt: true },
      });
    });

    it('rethrows any other database error', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      const otherError = new Error('connection lost');
      prisma.favorite.create.mockRejectedValue(otherError);

      await expect(service.create(userId, entryId)).rejects.toBe(otherError);
      expect(prisma.favorite.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it("deletes the user's row scoped by userId and entryId", async () => {
      prisma.favorite.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove(userId, entryId);

      expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({ where: { userId, entryId } });
    });

    it('resolves without error when there is nothing to delete', async () => {
      prisma.favorite.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove(userId, entryId)).resolves.toBeUndefined();
    });
  });
});
