import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and joins words with hyphens', () => {
    expect(slugify('React Hooks')).toBe('react-hooks');
  });

  it('strips accents', () => {
    expect(slugify('Étiquette')).toBe('etiquette');
  });

  it('trims and collapses extra hyphens', () => {
    expect(slugify('  Foo---Bar  ')).toBe('foo-bar');
  });
});
