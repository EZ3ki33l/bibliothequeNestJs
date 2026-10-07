import { validate } from 'class-validator';
import {
  IsPastOrPresentDay,
  dateToDay,
  dayToDate,
  isCalendarDay,
  isFutureDay,
  todayAsDay,
} from './calendar-day';

describe('calendar-day', () => {
  describe('todayAsDay', () => {
    it('returns the day as AAAA-MM-JJ', () => {
      expect(todayAsDay(new Date('2026-10-06T10:00:00.000Z'))).toBe('2026-10-06');
    });

    it('follows the Paris time zone, not UTC', () => {
      // 22 h 30 UTC le 6 octobre = 0 h 30 le 7 à Paris (UTC+2 en été).
      expect(todayAsDay(new Date('2026-10-06T22:30:00.000Z'))).toBe('2026-10-07');
    });

    it('reads the clock when no instant is given', () => {
      expect(isCalendarDay(todayAsDay())).toBe(true);
    });
  });

  describe('isCalendarDay', () => {
    it('accepts a real day', () => {
      expect(isCalendarDay('2026-10-06')).toBe(true);
      expect(isCalendarDay('2024-02-29')).toBe(true);
    });

    it('rejects any other format', () => {
      expect(isCalendarDay('06/10/2026')).toBe(false);
      expect(isCalendarDay('2026-10-06T00:00:00.000Z')).toBe(false);
      expect(isCalendarDay('2026-1-6')).toBe(false);
      expect(isCalendarDay('')).toBe(false);
    });

    it('rejects a day that does not exist', () => {
      expect(isCalendarDay('2026-02-30')).toBe(false);
      expect(isCalendarDay('2026-13-01')).toBe(false);
      expect(isCalendarDay('2025-02-29')).toBe(false);
    });

    it('rejects anything that is not a string', () => {
      expect(isCalendarDay(20261006)).toBe(false);
      expect(isCalendarDay(null)).toBe(false);
      expect(isCalendarDay(new Date())).toBe(false);
    });
  });

  describe('isFutureDay', () => {
    const now = new Date('2026-10-06T10:00:00.000Z');

    it('accepts today and the past', () => {
      expect(isFutureDay('2026-10-06', now)).toBe(false);
      expect(isFutureDay('2020-01-01', now)).toBe(false);
    });

    it('rejects tomorrow', () => {
      expect(isFutureDay('2026-10-07', now)).toBe(true);
    });

    it('accepts today in Paris while UTC is still on the previous day', () => {
      const justAfterMidnightInParis = new Date('2026-10-06T22:30:00.000Z');

      expect(isFutureDay('2026-10-07', justAfterMidnightInParis)).toBe(false);
      expect(isFutureDay('2026-10-08', justAfterMidnightInParis)).toBe(true);
    });
  });

  describe('dayToDate / dateToDay', () => {
    it('converts a day to UTC midnight, and back', () => {
      const date = dayToDate('2026-10-06');

      expect(date.toISOString()).toBe('2026-10-06T00:00:00.000Z');
      expect(dateToDay(date)).toBe('2026-10-06');
    });
  });

  describe('IsPastOrPresentDay', () => {
    class Sample {
      @IsPastOrPresentDay()
      day!: unknown;
    }

    async function errorsFor(day: unknown) {
      const sample = new Sample();
      sample.day = day;

      return validate(sample);
    }

    it('accepts a past day', async () => {
      expect(await errorsFor('2020-01-01')).toHaveLength(0);
    });

    it('rejects a future day, with a message naming the field', async () => {
      const errors = await errorsFor('2999-01-01');

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isPastOrPresentDay).toContain('day');
    });

    it('rejects a non-existent day and a non-string value', async () => {
      expect(await errorsFor('2026-02-30')).toHaveLength(1);
      expect(await errorsFor(42)).toHaveLength(1);
    });
  });
});
