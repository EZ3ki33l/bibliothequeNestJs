// `@Transform` lit des métadonnées : Nest charge ce module lui-même, un test
// qui n'importe pas Nest doit le faire.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEntryImageDto } from './update-entry-image.dto';
import { MAX_ALT_LENGTH, MAX_CAPTION_LENGTH, UploadEntryImageDto } from './upload-entry-image.dto';

/** Mêmes options que le `ValidationPipe` global de `main.ts`, absent de l'app e2e. */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

async function failed(dto: new () => object, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(dto, body), PIPE_OPTIONS);
  return errors.map((error) => error.property);
}

describe('UploadEntryImageDto', () => {
  it('accepts an alt text, with or without a caption, and trims them', async () => {
    await expect(failed(UploadEntryImageDto, { alt: 'Baie de brassage' })).resolves.toEqual([]);
    const dto = plainToInstance(UploadEntryImageDto, { alt: '  Baie  ', caption: ' Vue de face ' });
    expect([dto.alt, dto.caption]).toEqual(['Baie', 'Vue de face']);
  });

  it.each([
    ['no alt text', {}],
    ['an alt text of spaces', { alt: '   ' }],
    ['an alt text too long', { alt: 'a'.repeat(MAX_ALT_LENGTH + 1) }],
  ])('refuses %s', async (_label, body) => {
    await expect(failed(UploadEntryImageDto, body)).resolves.toEqual(['alt']);
  });

  it('refuses a caption too long and an unknown part', async () => {
    await expect(
      failed(UploadEntryImageDto, { alt: 'a', caption: 'c'.repeat(MAX_CAPTION_LENGTH + 1) }),
    ).resolves.toEqual(['caption']);
    await expect(failed(UploadEntryImageDto, { alt: 'a', url: 'https://x' })).resolves.toEqual([
      'url',
    ]);
  });
});

describe('UpdateEntryImageDto', () => {
  it('accepts either field alone', async () => {
    await expect(failed(UpdateEntryImageDto, { alt: 'Nouveau' })).resolves.toEqual([]);
    await expect(failed(UpdateEntryImageDto, { caption: '' })).resolves.toEqual([]);
  });

  it('refuses an emptied alt text', async () => {
    await expect(failed(UpdateEntryImageDto, { alt: ' ' })).resolves.toEqual(['alt']);
  });
});
