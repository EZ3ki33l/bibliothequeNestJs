import { ReviewRating } from '../generated/prisma/enums';

export type ScheduleReviewCard = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
};

export type ScheduleReviewResult = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
  lastReviewedAt: Date;
};

function addDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function scheduleReview(
  card: ScheduleReviewCard,
  rating: ReviewRating,
  now: Date,
): ScheduleReviewResult {
  const lastReviewedAt = new Date(now.getTime());

  if (rating === ReviewRating.AGAIN) {
    return {
      easeFactor: Math.max(1.3, card.easeFactor - 0.2),
      intervalDays: 0,
      repetitions: 0,
      lastReviewedAt,
      nextReviewAt: new Date(now.getTime()),
    };
  }

  if (card.repetitions === 0) {
    if (rating === ReviewRating.HARD) {
      return {
        easeFactor: Math.max(1.3, card.easeFactor - 0.15),
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: addDays(now, 1),
        lastReviewedAt,
      };
    }
    if (rating === ReviewRating.GOOD) {
      return {
        easeFactor: card.easeFactor,
        intervalDays: 3,
        repetitions: 1,
        nextReviewAt: addDays(now, 3),
        lastReviewedAt,
      };
    }
    return {
      easeFactor: card.easeFactor + 0.15,
      intervalDays: 7,
      repetitions: 1,
      nextReviewAt: addDays(now, 7),
      lastReviewedAt,
    };
  }

  if (rating === ReviewRating.HARD) {
    const intervalDays = Math.max(1, Math.round(card.intervalDays * 1.2));
    return {
      easeFactor: Math.max(1.3, card.easeFactor - 0.15),
      intervalDays,
      repetitions: card.repetitions,
      nextReviewAt: addDays(now, intervalDays),
      lastReviewedAt,
    };
  }

  if (rating === ReviewRating.GOOD) {
    const intervalDays = Math.max(1, Math.round(card.intervalDays * card.easeFactor));
    return {
      easeFactor: card.easeFactor,
      intervalDays,
      repetitions: card.repetitions,
      nextReviewAt: addDays(now, intervalDays),
      lastReviewedAt,
    };
  }

  const easeFactor = card.easeFactor + 0.15;
  const intervalDays = Math.max(
    card.intervalDays + 1,
    Math.round(card.intervalDays * easeFactor * 1.3),
  );
  return {
    easeFactor,
    intervalDays,
    repetitions: card.repetitions,
    nextReviewAt: addDays(now, intervalDays),
    lastReviewedAt,
  };
}
