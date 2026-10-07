// `@Transform` lit des métadonnées : Nest charge ce module lui-même, un test
// qui n'importe pas Nest doit le faire.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntryIdsQueryDto, MAX_ENTRY_IDS } from './entry-ids-query.dto';

/**
 * Le `ValidationPipe` global vit dans `main.ts` : l'application e2e ne l'a
 * pas. Ces tests appliquent donc directement ce qu'il fait, avec les mêmes
 * options : transformer la query en instance du DTO, puis la valider.
 */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

function toDto(query: Record<string, unknown>) {
  return plainToInstance(EntryIdsQueryDto, query);
}

function validateQuery(query: Record<string, unknown>) {
  return validate(toDto(query), PIPE_OPTIONS);
}

/** UUID v4 distincts et valides, fabriqués à partir d'un rang. */
function uuid(rank: number): string {
  return `00000000-0000-4000-8000-${String(rank).padStart(12, '0')}`;
}

function uuids(count: number): string {
  return Array.from({ length: count }, (_, rank) => uuid(rank)).join(',');
}

describe('EntryIdsQueryDto', () => {
  it('accepts a single uuid and turns it into a list', async () => {
    await expect(validateQuery({ ids: uuid(1) })).resolves.toHaveLength(0);
    expect(toDto({ ids: uuid(1) }).ids).toEqual([uuid(1)]);
  });

  it('splits a comma-separated string into its elements', () => {
    expect(toDto({ ids: `${uuid(1)},${uuid(2)}` }).ids).toEqual([uuid(1), uuid(2)]);
  });

  it(`accepts ${MAX_ENTRY_IDS} uuids`, async () => {
    await expect(validateQuery({ ids: uuids(MAX_ENTRY_IDS) })).resolves.toHaveLength(0);
  });

  it(`rejects ${MAX_ENTRY_IDS + 1} uuids`, async () => {
    const [error] = await validateQuery({ ids: uuids(MAX_ENTRY_IDS + 1) });

    expect(error.property).toBe('ids');
    expect(error.constraints).toHaveProperty('arrayMaxSize');
  });

  it('rejects a missing or empty ids', async () => {
    await expect(validateQuery({})).resolves.toHaveLength(1);
    await expect(validateQuery({ ids: '' })).resolves.toHaveLength(1);
  });

  it.each([
    'pas-un-uuid',
    `${uuid(1)},pas-un-uuid`,
    `${uuid(1)},`,
    `${uuid(1)} OR 1=1`,
    '../../admin',
  ])('rejects %p : every element must be a uuid', async (ids) => {
    const [error] = await validateQuery({ ids });

    expect(error.property).toBe('ids');
    expect(error.constraints).toHaveProperty('isUuid');
  });

  it('rejects a value that is neither a string nor a list of uuids', async () => {
    await expect(validateQuery({ ids: { $ne: null } })).resolves.toHaveLength(1);
    await expect(validateQuery({ ids: 42 })).resolves.toHaveLength(1);
  });

  it('accepts a repeated parameter (?ids=a&ids=b), already a list', async () => {
    await expect(validateQuery({ ids: [uuid(1), uuid(2)] })).resolves.toHaveLength(0);
  });

  it('rejects an unknown parameter, such as an account id', async () => {
    const errors = await validateQuery({ ids: uuid(1), userId: uuid(2) });

    expect(errors.map((error) => error.property)).toEqual(['userId']);
  });
});
