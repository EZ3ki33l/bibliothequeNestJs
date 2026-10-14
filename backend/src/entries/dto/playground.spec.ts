// `@Type` lit des métadonnées de type : Nest charge ce module lui-même, un
// test qui n'importe pas Nest doit le faire.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEntryDto } from './create-entry.dto';
import {
  MAX_PLAYGROUND_TEXT_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  PLAYGROUND_DEPENDENCIES_LIMITS,
  PLAYGROUND_FILES_LIMITS,
  isStringRecord,
} from './playground';
import { UpdateEntryDto } from './update-entry.dto';

/** Mêmes options que le `ValidationPipe` global de `main.ts`, absent de l'app e2e. */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

async function failedProperties(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(UpdateEntryDto, body), PIPE_OPTIONS);
  return errors.map((error) => error.property);
}

describe('isStringRecord', () => {
  const limits = { maxEntries: 2, maxKeyLength: 5, maxValueLength: 3 };

  it('accepts an empty object and text values within the limits', () => {
    expect(isStringRecord({}, limits)).toBe(true);
    expect(isStringRecord({ '/a': 'abc', '/b': '' }, limits)).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', ['a']],
    ['a string', 'abc'],
    ['a number value', { '/a': 1 }],
    ['a nested object', { '/a': { code: 'x' } }],
    ['an empty key', { ' ': 'a' }],
    ['a key too long', { '/abcde': 'a' }],
    ['a value too long', { '/a': 'abcd' }],
    ['too many entries', { '/a': '', '/b': '', '/c': '' }],
  ])('rejects %s', (_label, value) => {
    expect(isStringRecord(value, limits)).toBe(false);
  });
});

describe('entry DTOs, playground and tags', () => {
  it('accepts a react-ts playground with files and dependencies', async () => {
    await expect(
      failedProperties({
        template: 'react-ts',
        files: { '/App.tsx': 'export default function App() { return null; }' },
        dependencies: { 'react-markdown': '^10.0.0' },
        tags: ['react', 'hooks'],
      }),
    ).resolves.toEqual([]);
  });

  it('accepts the python environment, and rejects an unknown one', async () => {
    await expect(failedProperties({ template: 'python' })).resolves.toEqual([]);
    await expect(failedProperties({ template: 'cobol' })).resolves.toEqual(['template']);
  });

  it('bounds the input and the expected output of a Python playground', async () => {
    const max = 'a'.repeat(MAX_PLAYGROUND_TEXT_LENGTH);
    await expect(
      failedProperties({ playgroundInput: max, playgroundExpectedOutput: max }),
    ).resolves.toEqual([]);
    await expect(
      failedProperties({ playgroundInput: `${max}a`, playgroundExpectedOutput: `${max}a` }),
    ).resolves.toEqual(['playgroundInput', 'playgroundExpectedOutput']);
    await expect(failedProperties({ playgroundInput: 3 })).resolves.toEqual(['playgroundInput']);
  });

  it('rejects files whose code is not text', async () => {
    await expect(failedProperties({ files: { '/App.tsx': { code: 'x' } } })).resolves.toEqual([
      'files',
    ]);
  });

  it('rejects too many files or dependencies', async () => {
    const many = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, i) => [`/f${i}`, '']));

    await expect(
      failedProperties({
        files: many(PLAYGROUND_FILES_LIMITS.maxEntries + 1),
        dependencies: many(PLAYGROUND_DEPENDENCIES_LIMITS.maxEntries + 1),
      }),
    ).resolves.toEqual(['files', 'dependencies']);
  });

  it('bounds the number and the length of tags', async () => {
    await expect(
      failedProperties({ tags: Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`) }),
    ).resolves.toEqual(['tags']);
    await expect(failedProperties({ tags: ['a'.repeat(MAX_TAG_LENGTH + 1)] })).resolves.toEqual([
      'tags',
    ]);
  });

  it('applies the same rules at creation, and accepts a short draft body', async () => {
    const create = async (body: Record<string, unknown>) =>
      (
        await validate(
          plainToInstance(CreateEntryDto, {
            categoryId: '0b8e7c1e-3f0a-4c43-9d6a-2b1f3c4d5e6f',
            title: 'Ébauche',
            kind: 'FUNCTION',
            bodyMdx: 'Court.',
            ...body,
          }),
          PIPE_OPTIONS,
        )
      ).map((error) => error.property);

    await expect(
      create({ template: 'python', playgroundInput: '3\n12', playgroundExpectedOutput: '12' }),
    ).resolves.toEqual([]);
    await expect(
      create({
        template: 'cobol',
        playgroundExpectedOutput: 'a'.repeat(MAX_PLAYGROUND_TEXT_LENGTH + 1),
      }),
    ).resolves.toEqual(['template', 'playgroundExpectedOutput']);
  });
});
