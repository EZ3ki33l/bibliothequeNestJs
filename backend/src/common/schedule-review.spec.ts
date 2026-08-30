import { ReviewRating } from '../generated/prisma/enums';
import { scheduleReview } from './schedule-review';

const now = new Date('2026-08-30T12:00:00.000Z');
const newCard = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

describe('scheduleReview', () => {
  it('orders AGAIN ≤ now < HARD < GOOD < EASY on first graduation', () => {
    const again = scheduleReview(newCard, ReviewRating.AGAIN, now);
    const hard = scheduleReview(newCard, ReviewRating.HARD, now);
    const good = scheduleReview(newCard, ReviewRating.GOOD, now);
    const easy = scheduleReview(newCard, ReviewRating.EASY, now);

    expect(again.nextReviewAt.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(now.getTime()).toBeLessThanOrEqual(hard.nextReviewAt.getTime());
    expect(hard.nextReviewAt.getTime()).toBeLessThan(good.nextReviewAt.getTime());
    expect(good.nextReviewAt.getTime()).toBeLessThan(easy.nextReviewAt.getTime());
  });

  it('keeps the same order on later reviews', () => {
    const card = { easeFactor: 2.5, intervalDays: 3, repetitions: 1 };
    const again = scheduleReview(card, ReviewRating.AGAIN, now);
    const hard = scheduleReview(card, ReviewRating.HARD, now);
    const good = scheduleReview(card, ReviewRating.GOOD, now);
    const easy = scheduleReview(card, ReviewRating.EASY, now);

    expect(again.nextReviewAt.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(now.getTime()).toBeLessThanOrEqual(hard.nextReviewAt.getTime());
    expect(hard.nextReviewAt.getTime()).toBeLessThan(good.nextReviewAt.getTime());
    expect(good.nextReviewAt.getTime()).toBeLessThan(easy.nextReviewAt.getTime());
  });

  it('floors easeFactor at 1.3', () => {
    const lowEase = { easeFactor: 1.35, intervalDays: 0, repetitions: 0 };
    const again = scheduleReview(lowEase, ReviewRating.AGAIN, now);
    const hard = scheduleReview(lowEase, ReviewRating.HARD, now);

    expect(again.easeFactor).toBeCloseTo(1.3);
    expect(hard.easeFactor).toBeCloseTo(1.3);
  });
});
