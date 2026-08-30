import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewRating } from '../generated/prisma/enums';
import { scheduleReview } from '../common/schedule-review';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findDue(userId: string) {
    const dueWhere = {
      userId,
      nextReviewAt: { lte: new Date() },
      entry: { published: true },
    };

    const [cards, remaining] = await Promise.all([
      this.prisma.reviewCard.findMany({
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
      }),
      this.prisma.reviewCard.count({ where: dueWhere }),
    ]);

    return { current: cards[0] ?? null, remaining };
  }

  async ensure(userId: string, entryId: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, published: true },
      select: { id: true },
    });

    if (!entry) {
      throw new NotFoundException();
    }

    try {
      await this.prisma.reviewCard.upsert({
        where: { userId_entryId: { userId, entryId } },
        create: { userId, entryId, nextReviewAt: new Date() },
        update: {},
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  async rate(userId: string, cardId: string, rating: ReviewRating) {
    const now = new Date();

    const card = await this.prisma.reviewCard.findFirst({
      where: {
        id: cardId,
        userId,
        nextReviewAt: { lte: now },
        entry: { published: true },
      },
    });

    if (!card) {
      throw new NotFoundException();
    }

    const scheduled = scheduleReview(card, rating, now);

    await this.prisma.reviewCard.update({
      where: { id: card.id },
      data: {
        easeFactor: scheduled.easeFactor,
        intervalDays: scheduled.intervalDays,
        repetitions: scheduled.repetitions,
        nextReviewAt: scheduled.nextReviewAt,
        lastReviewedAt: scheduled.lastReviewedAt,
      },
    });
    await this.prisma.reviewLog.create({
      data: { cardId: card.id, rating },
    });

    return this.findDue(userId);
  }
}
