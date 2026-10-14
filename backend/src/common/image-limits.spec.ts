import {
  IMAGE_UPLOAD_WINDOW_MS,
  MAX_IMAGE_UPLOADS_PER_HOUR,
  orphanKeys,
  uploadRetryAt,
} from './image-limits';

const NOW = new Date('2026-10-14T12:00:00.000Z');

/** `count` envois espacés d'une minute, le plus récent à `NOW`. */
function uploads(count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(NOW.getTime() - i * 60_000));
}

describe('uploadRetryAt', () => {
  it('lets an account under the limit upload', () => {
    expect(uploadRetryAt(uploads(MAX_IMAGE_UPLOADS_PER_HOUR - 1), NOW)).toBeNull();
  });

  it('ignores uploads older than the window', () => {
    const old = Array.from(
      { length: MAX_IMAGE_UPLOADS_PER_HOUR },
      () => new Date(NOW.getTime() - IMAGE_UPLOAD_WINDOW_MS - 1),
    );
    expect(uploadRetryAt(old, NOW)).toBeNull();
  });

  it('gives the moment the oldest upload of the window leaves it', () => {
    const dates = uploads(MAX_IMAGE_UPLOADS_PER_HOUR);
    const oldest = Math.min(...dates.map((d) => d.getTime()));

    expect(uploadRetryAt(dates, NOW)).toEqual(new Date(oldest + IMAGE_UPLOAD_WINDOW_MS));
  });

  it('handles uploads given in any order and beyond the limit', () => {
    const dates = uploads(MAX_IMAGE_UPLOADS_PER_HOUR + 2).reverse();
    const sorted = dates.map((d) => d.getTime()).sort((a, b) => a - b);
    const blocking = sorted[sorted.length - MAX_IMAGE_UPLOADS_PER_HOUR];

    expect(uploadRetryAt(dates, NOW)).toEqual(new Date(blocking + IMAGE_UPLOAD_WINDOW_MS));
  });
});

describe('orphanKeys', () => {
  it('keeps only the stored files that no image references', () => {
    expect(orphanKeys(['a', 'b', 'c'], new Set(['b']))).toEqual(['a', 'c']);
  });

  it('returns nothing when every file is referenced', () => {
    expect(orphanKeys(['a'], new Set(['a', 'z']))).toEqual([]);
  });
});
