import { MediaCache } from './media-cache';

const bytes = (n: number) => Buffer.alloc(n);

describe('MediaCache', () => {
  it('returns what was stored', () => {
    const cache = new MediaCache(100, 50);
    cache.set('a', bytes(10));
    expect(cache.get('a')?.length).toBe(10);
    expect(cache.get('b')).toBeUndefined();
  });

  it('evicts the least recently used entries beyond its total size', () => {
    const cache = new MediaCache(30, 20);
    cache.set('a', bytes(10));
    cache.set('b', bytes(10));
    cache.set('c', bytes(10));
    cache.get('a'); // « a » redevient récent ; « b » est désormais le plus ancien.
    cache.set('d', bytes(10));

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
    expect(cache.get('d')).toBeDefined();
    expect(cache.size).toBe(30);
  });

  it('ignores an entry larger than the per-entry limit', () => {
    const cache = new MediaCache(100, 20);
    cache.set('big', bytes(21));
    expect(cache.get('big')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('replaces an entry without counting it twice, and deletes on demand', () => {
    const cache = new MediaCache(100, 50);
    cache.set('a', bytes(10));
    cache.set('a', bytes(15));
    expect(cache.size).toBe(15);
    cache.delete('a');
    cache.delete('absent');
    expect(cache.size).toBe(0);
  });
});
