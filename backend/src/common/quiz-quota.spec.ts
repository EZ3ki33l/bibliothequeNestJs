import { MAX_QUIZ_STARTS_PER_HOUR, QUIZ_QUOTA_WINDOW_MS, quizRetryAt } from './quiz-quota';

const now = new Date('2026-10-06T20:00:00.000Z');

/** Date située `minutes` avant `now`. */
function minutesAgo(minutes: number): Date {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

/** `count` tentatives, une par minute, la plus ancienne en premier. */
function attempts(count: number, oldestMinutesAgo: number): Date[] {
  return Array.from({ length: count }, (_, rank) => minutesAgo(oldestMinutesAgo - rank));
}

describe('quizRetryAt', () => {
  it('allows a first quiz', () => {
    expect(quizRetryAt([], now)).toBeNull();
  });

  it('allows a start under the cap', () => {
    expect(quizRetryAt(attempts(MAX_QUIZ_STARTS_PER_HOUR - 1, 30), now)).toBeNull();
  });

  it('refuses at the cap and says when the oldest attempt leaves the window', () => {
    const started = attempts(MAX_QUIZ_STARTS_PER_HOUR, 45);

    expect(quizRetryAt(started, now)).toEqual(
      new Date(minutesAgo(45).getTime() + QUIZ_QUOTA_WINDOW_MS),
    );
  });

  it('does not depend on the order of the dates', () => {
    const started = attempts(MAX_QUIZ_STARTS_PER_HOUR, 45).reverse();

    expect(quizRetryAt(started, now)).toEqual(
      new Date(minutesAgo(45).getTime() + QUIZ_QUOTA_WINDOW_MS),
    );
  });

  it('ignores attempts that left the window', () => {
    const started = [...attempts(5, 300), ...attempts(MAX_QUIZ_STARTS_PER_HOUR - 1, 30)];

    expect(quizRetryAt(started, now)).toBeNull();
  });

  it('treats an attempt exactly one hour old as out of the window', () => {
    const started = [minutesAgo(60), ...attempts(MAX_QUIZ_STARTS_PER_HOUR - 1, 30)];

    expect(quizRetryAt(started, now)).toBeNull();
  });

  it('above the cap, waits for the attempt whose exit brings the account back under it', () => {
    // Douze tentatives : il faut que les trois plus anciennes sortent.
    const started = attempts(MAX_QUIZ_STARTS_PER_HOUR + 2, 50);

    expect(quizRetryAt(started, now)).toEqual(
      new Date(minutesAgo(48).getTime() + QUIZ_QUOTA_WINDOW_MS),
    );
  });

  it('always answers a date in the future when it refuses', () => {
    const retryAt = quizRetryAt(attempts(MAX_QUIZ_STARTS_PER_HOUR, 59), now);

    expect(retryAt).not.toBeNull();
    expect(retryAt!.getTime()).toBeGreaterThan(now.getTime());
  });
});
