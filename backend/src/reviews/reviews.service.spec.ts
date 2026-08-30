import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewsService } from './reviews.service';
import { Prisma } from '../generated/prisma/client';
import { ReviewRating } from '../generated/prisma/enums';
import { NotFoundException } from '@nestjs/common';

const userId = 'user-1';
const entryId = 'entry-1';

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

const currentCard = {
  id: 'card-1',
  nextReviewAt: new Date('2026-08-29T17:00:00.000Z'),
  entry: {
    id: 'entry1',
    title: 'useState',
    slug: 'useState',
    summary: 'Etat local',
    bodyMdx: 'Le hook useState...',
    kind: 'FUNCTION',
  },
};

const dueCard = {
  id: 'card-1',
  easeFactor: 2.5,
  intervalDays: 3,
  repetitions: 2,
};

describe('ReviewsService', () => {
  let service: ReviewsService;
  const prisma = {
    entry: {
      findFirst: jest.fn(),
    },
    reviewCard: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    reviewLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ReviewsService);
  });

  describe('FindDue', () => {
    it('filtes by userId, due date, and published entries', async () => {
      prisma.reviewCard.findMany.mockResolvedValue([currentCard]);
      prisma.reviewCard.count.mockResolvedValue(1);

      await service.findDue(userId);
      const dueWhere = {
        userId,
        nextReviewAt: { lte: expect.any(Date) },
        entry: { published: true },
      };

      expect(prisma.reviewCard.findMany).toHaveBeenCalledWith({
        where: dueWhere,
        orderBy: [{ nextReviewAt: 'asc' }, { id: 'asc' }],
        take: 1,
        select: {
          id: true,
          nextReviewAt: true,
          entry: {
            select: {
              id: true,
              title: true,
              slug: true,
              summary: true,
              bodyMdx: true,
              kind: true,
            },
          },
        },
      });
      expect(prisma.reviewCard.count).toHaveBeenCalledWith({ where: dueWhere });
    });
    it('ignores drafts via entry.published', async () => {
      prisma.reviewCard.findMany.mockResolvedValue([]);
      prisma.reviewCard.count.mockResolvedValue(0);
      await service.findDue(userId);
      expect(prisma.reviewCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entry: { published: true } }),
        }),
      );
    });
    it('includes the current card in remaining', async () => {
      prisma.reviewCard.findMany.mockResolvedValue([currentCard]);
      prisma.reviewCard.count.mockResolvedValue(3);
      await expect(service.findDue(userId)).resolves.toEqual({
        current: currentCard,
        remaining: 3,
      });
    });
    it('returns current null and remaining 0 when the queue is empty', async () => {
      prisma.reviewCard.findMany.mockResolvedValue([]);
      prisma.reviewCard.count.mockResolvedValue(0);
      await expect(service.findDue(userId)).resolves.toEqual({
        current: null,
        remaining: 0,
      });
    });
  });

  describe('Ensure', () => {
    const upsertArgs = {
      where: { userId_entryId: { userId, entryId } },
      create: { userId, entryId, nextReviewAt: expect.any(Date) },
      update: {},
    };

    it('throws NotFoundException for an unknown entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);
      await expect(service.ensure(userId, entryId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.entry.findFirst).toHaveBeenCalledWith({
        where: { id: entryId, published: true },
        select: { id: true },
      });
      expect(prisma.reviewCard.upsert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unpublished entry', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);
      await expect(service.ensure(userId, entryId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.reviewCard.upsert).not.toHaveBeenCalled();
    });

    it('does not reset nextReviewAt on a second call', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      prisma.reviewCard.upsert.mockResolvedValue({});
      await expect(service.ensure(userId, entryId)).resolves.toBeUndefined();
      expect(prisma.reviewCard.upsert).toHaveBeenCalledWith(upsertArgs);
    });

    it('treats Prisma P2002 as a silent success', async () => {
      prisma.entry.findFirst.mockResolvedValue({ id: entryId });
      prisma.reviewCard.upsert.mockRejectedValue(knownRequestError('P2002'));
      await expect(service.ensure(userId, entryId)).resolves.toBeUndefined();
    });
  });

  describe('Rate', () => {
    const dueWhere = {
      id: 'card-1',
      userId,
      nextReviewAt: { lte: expect.any(Date) },
      entry: { published: true },
    };
    it("throws NotFoundException for another user's card", async () => {
      prisma.reviewCard.findFirst.mockResolvedValue(null);
      await expect(service.rate(userId, 'card-1', ReviewRating.GOOD)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.reviewCard.findFirst).toHaveBeenCalledWith({ where: dueWhere });
      expect(prisma.reviewCard.update).not.toHaveBeenCalled();
    });
    it('throws NotFoundException for an unknown card', async () => {
      prisma.reviewCard.findFirst.mockResolvedValue(null);
      await expect(service.rate(userId, 'card-1', ReviewRating.GOOD)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('throws NotFoundException when the card is not due', async () => {
      prisma.reviewCard.findFirst.mockResolvedValue(null);
      await expect(service.rate(userId, 'card-1', ReviewRating.GOOD)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('throws NotFoundException when the entry is unpublished', async () => {
      prisma.reviewCard.findFirst.mockResolvedValue(null);
      await expect(service.rate(userId, 'card-1', ReviewRating.GOOD)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('keeps the card due after AGAIN', async () => {
      prisma.reviewCard.findFirst.mockResolvedValue(dueCard);
      prisma.reviewCard.update.mockResolvedValue({});
      prisma.reviewLog.create.mockResolvedValue({});
      prisma.reviewCard.findMany.mockResolvedValue([currentCard]);
      prisma.reviewCard.count.mockResolvedValue(1);
      await expect(service.rate(userId, 'card-1', ReviewRating.AGAIN)).resolves.toEqual({
        current: currentCard,
        remaining: 1,
      });
      expect(prisma.reviewCard.update).toHaveBeenCalledWith({
        where: { id: 'card-1' },
        data: expect.objectContaining({
          intervalDays: 0,
          repetitions: 0,
          nextReviewAt: expect.any(Date),
        }),
      });
      expect(prisma.reviewLog.create).toHaveBeenCalledWith({
        data: { cardId: 'card-1', rating: ReviewRating.AGAIN },
      });
    });
  });
});
