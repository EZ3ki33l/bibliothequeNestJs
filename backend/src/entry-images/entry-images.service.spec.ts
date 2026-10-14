import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { AdminRole } from '../generated/prisma/enums';
import {
  MAX_IMAGES_PER_ENTRY,
  MAX_IMAGE_UPLOADS_PER_HOUR,
  STORAGE_LIMIT_BYTES,
} from '../common/image-limits';
import {
  EntryImagesService,
  NO_FILE,
  NOTHING_TO_UPDATE,
  STORAGE_FULL,
  TOO_MANY_IMAGES,
} from './entry-images.service';
import { ImageEncoder } from './image-encoder';
import { IMAGE_STORAGE } from './image-storage';
import { MediaCache } from './media-cache';
import { STORAGE_UNAVAILABLE } from './uploadthing-image-storage';

const ENTRY_ID = '0b8e7c1e-3f0a-4c43-9d6a-2b1f3c4d5e6f';
const IMAGE_ID = '6f1c2a9e-3b0d-4c55-9a8e-1d2f3a4b5c6d';
const USER_ID = 'user-1';

const row = {
  id: IMAGE_ID,
  alt: 'Baie de brassage',
  caption: '',
  readingWidth: 1600,
  readingHeight: 900,
  readingBytes: 1000,
  fullWidth: 3200,
  fullHeight: 1800,
  fullBytes: 5000,
  createdAt: new Date('2026-10-14T10:00:00.000Z'),
};

const encoded = {
  reading: { buffer: Buffer.from('r'), width: 1600, height: 900, bytes: 1000 },
  full: { buffer: Buffer.from('f'), width: 3200, height: 1800, bytes: 5000 },
};

const file = { buffer: Buffer.from('image') };

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', { code, clientVersion: '7.9.1' });
}

describe('EntryImagesService', () => {
  let service: EntryImagesService;
  let cache: MediaCache;

  const prisma = {
    entry: { findUnique: jest.fn() },
    entryImage: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
  };
  const encoder = { encode: jest.fn() };
  const storage = { put: jest.fn(), read: jest.fn(), remove: jest.fn(), list: jest.fn() };

  /** Fiche existante, sous tous les plafonds. */
  function happyPath(published = false) {
    prisma.entry.findUnique.mockResolvedValue({ published });
    prisma.entryImage.count.mockResolvedValue(0);
    prisma.entryImage.findMany.mockResolvedValue([]);
    prisma.entryImage.aggregate.mockResolvedValue({
      _sum: { readingBytes: 0, fullBytes: 0 },
      _count: { _all: 0 },
    });
    encoder.encode.mockResolvedValue(encoded);
    storage.put.mockResolvedValue([
      { key: 'k-reading', size: 1000 },
      { key: 'k-full', size: 5000 },
    ]);
    storage.remove.mockResolvedValue(true);
    prisma.entryImage.create.mockResolvedValue(row);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    cache = new MediaCache(1024, 512);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntryImagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ImageEncoder, useValue: encoder },
        { provide: MediaCache, useValue: cache },
        { provide: IMAGE_STORAGE, useValue: storage },
      ],
    }).compile();
    service = module.get(EntryImagesService);
  });

  describe('upload', () => {
    it('encodes, stores both versions, records the image and returns the markdown reference', async () => {
      happyPath();

      const result = await service.upload(
        ENTRY_ID,
        file,
        { alt: 'Baie de brassage' },
        AdminRole.ADMIN,
        USER_ID,
      );

      expect(encoder.encode).toHaveBeenCalledWith(file.buffer);
      expect(storage.put).toHaveBeenCalledWith([
        expect.objectContaining({ body: encoded.reading.buffer }),
        expect.objectContaining({ body: encoded.full.buffer }),
      ]);
      expect(prisma.entryImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entryId: ENTRY_ID,
            readingKey: 'k-reading',
            fullKey: 'k-full',
            uploadedById: USER_ID,
            caption: '',
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: IMAGE_ID,
          width: 1600,
          fullWidth: 3200,
          readingBytes: 1000,
          markdown: `![Baie de brassage](/media/${IMAGE_ID})`,
        }),
      );
      expect(JSON.stringify(result)).not.toContain('k-reading');
    });

    it('gives 404 for an unknown entry, before anything else', async () => {
      prisma.entry.findUnique.mockResolvedValue(null);

      await expect(
        service.upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.SUPER_ADMIN, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(encoder.encode).not.toHaveBeenCalled();
    });

    it('refuses an ADMIN on a published entry (403) but lets a SUPER_ADMIN in', async () => {
      happyPath(true);

      await expect(
        service.upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.ADMIN, USER_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.put).not.toHaveBeenCalled();

      await expect(
        service.upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.SUPER_ADMIN, USER_ID),
      ).resolves.toBeDefined();
    });

    it('refuses a 21st image (409)', async () => {
      happyPath();
      prisma.entryImage.count.mockResolvedValue(MAX_IMAGES_PER_ENTRY);

      await expect(
        service.upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.ADMIN, USER_ID),
      ).rejects.toEqual(new ConflictException(TOO_MANY_IMAGES));
    });

    it('refuses beyond the hourly upload limit (429 with retryAt)', async () => {
      happyPath();
      const now = Date.now();
      prisma.entryImage.findMany.mockResolvedValue(
        Array.from({ length: MAX_IMAGE_UPLOADS_PER_HOUR }, (_, i) => ({
          createdAt: new Date(now - i * 1000),
        })),
      );

      const error: unknown = await service
        .upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.ADMIN, USER_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((error as HttpException).getResponse()).toEqual(
        expect.objectContaining({ retryAt: expect.any(String) }),
      );
      expect(encoder.encode).not.toHaveBeenCalled();
    });

    it('refuses a missing or empty file (400)', async () => {
      happyPath();

      await expect(
        service.upload(ENTRY_ID, undefined, { alt: 'a' }, AdminRole.ADMIN, USER_ID),
      ).rejects.toEqual(new BadRequestException(NO_FILE));
      await expect(
        service.upload(
          ENTRY_ID,
          { buffer: Buffer.alloc(0) },
          { alt: 'a' },
          AdminRole.ADMIN,
          USER_ID,
        ),
      ).rejects.toEqual(new BadRequestException(NO_FILE));
    });

    it('refuses when the storage volume would go beyond the limit (409), storing nothing', async () => {
      happyPath();
      prisma.entryImage.aggregate.mockResolvedValue({
        _sum: { readingBytes: STORAGE_LIMIT_BYTES - 5000, fullBytes: 0 },
        _count: { _all: 10 },
      });

      await expect(
        service.upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.ADMIN, USER_ID),
      ).rejects.toEqual(new ConflictException(STORAGE_FULL));
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('creates no row when the storage is unavailable (503)', async () => {
      happyPath();
      storage.put.mockRejectedValue(new ServiceUnavailableException(STORAGE_UNAVAILABLE));

      await expect(
        service.upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.ADMIN, USER_ID),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.entryImage.create).not.toHaveBeenCalled();
    });

    it('removes the stored files when the database write fails, and maps a vanished entry to 404', async () => {
      happyPath();
      prisma.entryImage.create.mockRejectedValue(knownRequestError('P2003'));

      await expect(
        service.upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.ADMIN, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.remove).toHaveBeenCalledWith(['k-reading', 'k-full']);

      const other = new Error('base indisponible');
      prisma.entryImage.create.mockRejectedValue(other);
      await expect(
        service.upload(ENTRY_ID, file, { alt: 'a' }, AdminRole.ADMIN, USER_ID),
      ).rejects.toBe(other);
    });

    it('escapes the alt text in the markdown reference', async () => {
      happyPath();
      prisma.entryImage.create.mockResolvedValue({ ...row, alt: 'a]b\n[c' });

      const result = await service.upload(ENTRY_ID, file, { alt: 'x' }, AdminRole.ADMIN, USER_ID);

      expect(result.markdown).toBe(`![a\\]b \\[c](/media/${IMAGE_ID})`);
    });
  });

  describe('update', () => {
    it('updates alt text and caption of an image of this entry', async () => {
      prisma.entryImage.findFirst.mockResolvedValue({
        readingKey: 'k-r',
        fullKey: 'k-f',
        entry: { published: false },
      });
      prisma.entryImage.update.mockResolvedValue({ ...row, alt: 'Nouveau' });

      await expect(
        service.update(ENTRY_ID, IMAGE_ID, { alt: 'Nouveau' }, AdminRole.ADMIN),
      ).resolves.toEqual(expect.objectContaining({ alt: 'Nouveau' }));
      expect(prisma.entryImage.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: IMAGE_ID, entryId: ENTRY_ID } }),
      );
    });

    it('gives 404 for an image of another entry, 403 for an ADMIN on a published entry, 400 with nothing to update', async () => {
      prisma.entryImage.findFirst.mockResolvedValue(null);
      await expect(
        service.update(ENTRY_ID, IMAGE_ID, { alt: 'a' }, AdminRole.SUPER_ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.entryImage.findFirst.mockResolvedValue({
        readingKey: 'k-r',
        fullKey: 'k-f',
        entry: { published: true },
      });
      await expect(
        service.update(ENTRY_ID, IMAGE_ID, { alt: 'a' }, AdminRole.ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await expect(service.update(ENTRY_ID, IMAGE_ID, {}, AdminRole.SUPER_ADMIN)).rejects.toEqual(
        new BadRequestException(NOTHING_TO_UPDATE),
      );
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.entryImage.findFirst.mockResolvedValue({
        readingKey: 'k-r',
        fullKey: 'k-f',
        entry: { published: false },
      });
    });

    it('deletes the row, empties the cache, then removes the files', async () => {
      cache.set('k-r', Buffer.from('cached'));
      storage.remove.mockResolvedValue(true);

      await service.remove(ENTRY_ID, IMAGE_ID, AdminRole.ADMIN);

      expect(prisma.entryImage.delete).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
      expect(cache.get('k-r')).toBeUndefined();
      expect(storage.remove).toHaveBeenCalledWith(['k-r', 'k-f']);
    });

    it('succeeds even when the storage refuses to remove the files', async () => {
      storage.remove.mockResolvedValue(false);

      await expect(service.remove(ENTRY_ID, IMAGE_ID, AdminRole.ADMIN)).resolves.toBeUndefined();
    });

    it('refuses an ADMIN on a published entry', async () => {
      prisma.entryImage.findFirst.mockResolvedValue({
        readingKey: 'k-r',
        fullKey: 'k-f',
        entry: { published: true },
      });

      await expect(service.remove(ENTRY_ID, IMAGE_ID, AdminRole.ADMIN)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.entryImage.delete).not.toHaveBeenCalled();
    });
  });

  describe('usage, keysFor and purge', () => {
    it('sums both versions of every image', async () => {
      prisma.entryImage.aggregate.mockResolvedValue({
        _sum: { readingBytes: 100, fullBytes: 400 },
        _count: { _all: 2 },
      });

      await expect(service.usage()).resolves.toEqual({
        usedBytes: 500,
        limitBytes: STORAGE_LIMIT_BYTES,
        imageCount: 2,
      });

      prisma.entryImage.aggregate.mockResolvedValue({
        _sum: { readingBytes: null, fullBytes: null },
        _count: { _all: 0 },
      });
      await expect(service.usage()).resolves.toEqual(expect.objectContaining({ usedBytes: 0 }));
    });

    it('collects the keys of the entries targeted by a deletion', async () => {
      prisma.entryImage.findMany.mockResolvedValue([
        { readingKey: 'a', fullKey: 'b' },
        { readingKey: 'c', fullKey: 'd' },
      ]);

      await expect(service.keysFor({ categoryId: 'cat' })).resolves.toEqual(['a', 'b', 'c', 'd']);
      expect(prisma.entryImage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entry: { categoryId: 'cat' } } }),
      );
    });

    it('purges without throwing, and does nothing for an empty list', async () => {
      storage.remove.mockResolvedValue(false);
      await expect(service.purge(['a'])).resolves.toBeUndefined();

      await service.purge([]);
      expect(storage.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('readVariant', () => {
    it('serves from the cache without calling the storage', async () => {
      prisma.entryImage.findUnique.mockResolvedValue({ readingKey: 'k-r', fullKey: 'k-f' });
      cache.set('k-f', Buffer.from('full'));

      await expect(service.readVariant(IMAGE_ID, 'full')).resolves.toEqual(Buffer.from('full'));
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('reads from the storage, then keeps the file in the cache', async () => {
      prisma.entryImage.findUnique.mockResolvedValue({ readingKey: 'k-r', fullKey: 'k-f' });
      storage.read.mockResolvedValue(Buffer.from('reading'));

      await service.readVariant(IMAGE_ID, 'reading');
      await service.readVariant(IMAGE_ID, 'reading');

      expect(storage.read).toHaveBeenCalledTimes(1);
      expect(storage.read).toHaveBeenCalledWith('k-r');
    });

    it('gives 404 for an unknown image and 503 when the storage does not answer', async () => {
      prisma.entryImage.findUnique.mockResolvedValue(null);
      await expect(service.readVariant(IMAGE_ID, 'reading')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.entryImage.findUnique.mockResolvedValue({ readingKey: 'k-r', fullKey: 'k-f' });
      storage.read.mockResolvedValue(null);
      await expect(service.readVariant(IMAGE_ID, 'reading')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
