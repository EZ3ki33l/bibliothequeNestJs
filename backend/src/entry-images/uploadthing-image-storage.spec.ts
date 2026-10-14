import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  appIdFromToken,
  STORAGE_UNAVAILABLE,
  UploadThingImageStorage,
} from './uploadthing-image-storage';

function token(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function storageWith(value: string | undefined) {
  const config = { get: () => value } as unknown as ConfigService;
  return new UploadThingImageStorage(config);
}

describe('appIdFromToken', () => {
  it('reads the application id of a well-formed token', () => {
    expect(appIdFromToken(token({ apiKey: 'sk_x', appId: 'abc123', regions: ['sea1'] }))).toBe(
      'abc123',
    );
  });

  it.each([
    ['an absent token', undefined],
    ['an empty token', ''],
    ['a token that is not base64 JSON', 'pas-un-jeton'],
    ['a token without appId', token({ apiKey: 'sk_x' })],
    ['an appId that could change the host', token({ appId: 'evil.com/x' })],
  ])('returns null for %s', (_label, value) => {
    expect(appIdFromToken(value)).toBeNull();
  });
});

describe('UploadThingImageStorage without a token', () => {
  const storage = storageWith(undefined);

  it('refuses to store, with a 503', async () => {
    await expect(storage.put([{ name: 'a.webp', body: Buffer.from('x') }])).rejects.toEqual(
      new ServiceUnavailableException(STORAGE_UNAVAILABLE),
    );
  });

  it('reads nothing and removes nothing, without throwing', async () => {
    await expect(storage.read('abc')).resolves.toBeNull();
    await expect(storage.remove(['abc'])).resolves.toBe(false);
    await expect(storage.remove([])).resolves.toBe(true);
  });

  it('refuses a key that could change the path, even with a token', async () => {
    const withToken = storageWith(token({ appId: 'abc123' }));
    await expect(withToken.read('../x')).resolves.toBeNull();
  });
});
