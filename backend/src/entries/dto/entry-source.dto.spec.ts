// `@Type` lit des métadonnées de type : Nest charge ce module lui-même, un
// test qui n'importe pas Nest doit le faire.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntrySourceDto, MAX_ENTRY_SOURCES } from './entry-source.dto';
import { UpdateEntryDto } from './update-entry.dto';

/**
 * Le `ValidationPipe` global vit dans `main.ts` : l'application e2e ne l'a
 * pas. Ces tests appliquent donc directement ce qu'il fait, avec les mêmes
 * options : transformer le corps en instance du DTO, puis le valider.
 */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

function validateSource(body: Record<string, unknown>) {
  return validate(plainToInstance(EntrySourceDto, body), PIPE_OPTIONS);
}

function validateEntry(body: Record<string, unknown>) {
  return validate(plainToInstance(UpdateEntryDto, body), PIPE_OPTIONS);
}

const source = { title: 'useState', url: 'https://react.dev/reference/react/useState' };

describe('EntrySourceDto', () => {
  it('accepts a title and an https link alone', async () => {
    await expect(validateSource(source)).resolves.toHaveLength(0);
  });

  it('accepts a complete source', async () => {
    await expect(
      validateSource({
        ...source,
        publisher: 'react.dev',
        consultedOn: '2026-01-15',
        licenseName: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        adapted: true,
      }),
    ).resolves.toHaveLength(0);
  });

  it.each([
    'http://react.dev/reference',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://react.dev',
    'react.dev/reference',
    '//react.dev/reference',
    '',
  ])('rejects the link %p, for url and licenseUrl alike', async (link) => {
    const [urlError] = await validateSource({ ...source, url: link });
    expect(urlError.property).toBe('url');

    const [licenseError] = await validateSource({ ...source, licenseUrl: link });
    expect(licenseError.property).toBe('licenseUrl');
  });

  it('names the field and the expected protocol in the message', async () => {
    const [error] = await validateSource({ ...source, url: 'javascript:alert(1)' });

    expect(error.constraints?.isUrl).toBe('url doit être une adresse commençant par https://');
  });

  it('rejects a missing, empty or blank title, and trims it', async () => {
    await expect(validateSource({ url: source.url })).resolves.toHaveLength(1);
    await expect(validateSource({ ...source, title: '' })).resolves.toHaveLength(1);
    await expect(validateSource({ ...source, title: '   ' })).resolves.toHaveLength(1);

    expect(plainToInstance(EntrySourceDto, { ...source, title: '  useState  ' }).title).toBe(
      'useState',
    );
  });

  it('bounds every text field', async () => {
    await expect(validateSource({ ...source, title: 'a'.repeat(201) })).resolves.toHaveLength(1);
    await expect(
      validateSource({ ...source, url: `https://react.dev/${'a'.repeat(2048)}` }),
    ).resolves.toHaveLength(1);
    await expect(validateSource({ ...source, publisher: 'a'.repeat(121) })).resolves.toHaveLength(
      1,
    );
    await expect(validateSource({ ...source, licenseName: 'a'.repeat(81) })).resolves.toHaveLength(
      1,
    );
  });

  it('rejects a future or malformed consultation day', async () => {
    await expect(validateSource({ ...source, consultedOn: '2999-01-01' })).resolves.toHaveLength(1);
    await expect(validateSource({ ...source, consultedOn: '2026-02-30' })).resolves.toHaveLength(1);
    await expect(
      validateSource({ ...source, consultedOn: '2026-01-15T10:00:00.000Z' }),
    ).resolves.toHaveLength(1);
  });

  it('rejects a non-boolean adapted flag and any unknown field', async () => {
    await expect(validateSource({ ...source, adapted: 'oui' })).resolves.toHaveLength(1);
    await expect(validateSource({ ...source, position: 3 })).resolves.toHaveLength(1);
    await expect(validateSource({ ...source, entryId: 'e1' })).resolves.toHaveLength(1);
  });
});

describe('UpdateEntryDto (sources and verification)', () => {
  it('accepts a body without any of the new fields', async () => {
    await expect(validateEntry({ published: true })).resolves.toHaveLength(0);
  });

  it('validates each source of the list (nested DTO)', async () => {
    const errors = await validateEntry({
      sources: [source, { title: 'Piège', url: 'javascript:alert(1)' }],
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('sources');
    // Le deuxième élément (index 1) porte l'erreur, sur son champ `url`.
    expect(errors[0].children?.[0].property).toBe('1');
    expect(errors[0].children?.[0].children?.[0].property).toBe('url');
  });

  it('rejects an unknown field inside a source', async () => {
    await expect(
      validateEntry({ sources: [{ ...source, onclick: 'alert(1)' }] }),
    ).resolves.toHaveLength(1);
  });

  it('accepts an empty list and rejects more than the maximum', async () => {
    await expect(validateEntry({ sources: [] })).resolves.toHaveLength(0);
    await expect(
      validateEntry({ sources: Array.from({ length: MAX_ENTRY_SOURCES }, () => source) }),
    ).resolves.toHaveLength(0);
    await expect(
      validateEntry({ sources: Array.from({ length: MAX_ENTRY_SOURCES + 1 }, () => source) }),
    ).resolves.toHaveLength(1);
  });

  it('rejects sources that are not a list of objects', async () => {
    await expect(validateEntry({ sources: 'https://react.dev' })).resolves.toHaveLength(1);
    await expect(validateEntry({ sources: ['https://react.dev'] })).resolves.toHaveLength(1);
  });

  it('accepts a past verification day or null, and rejects a future one', async () => {
    await expect(validateEntry({ verifiedOn: '2026-01-15' })).resolves.toHaveLength(0);
    await expect(validateEntry({ verifiedOn: null })).resolves.toHaveLength(0);
    await expect(validateEntry({ verifiedOn: '2999-01-01' })).resolves.toHaveLength(1);
    await expect(validateEntry({ verifiedOn: '2026-02-30' })).resolves.toHaveLength(1);
  });

  it('bounds the verified version', async () => {
    await expect(validateEntry({ verifiedVersion: 'React 19' })).resolves.toHaveLength(0);
    await expect(validateEntry({ verifiedVersion: '' })).resolves.toHaveLength(0);
    await expect(validateEntry({ verifiedVersion: 'a'.repeat(61) })).resolves.toHaveLength(1);
  });
});
