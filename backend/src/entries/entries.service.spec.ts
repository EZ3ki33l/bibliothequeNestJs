import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { EntriesService } from './entries.service';

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

describe('EntriesService', () => {
  let service: EntriesService;
  const prisma = {
    category: {
      findUnique: jest.fn(),
    },
    entry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(EntriesService);
  });

  describe('findPublished', () => {
    it('lists only published entries', async () => {
      const rows = [{ id: 'e1', published: true }];
      prisma.entry.findMany.mockResolvedValue(rows);

      await expect(service.findPublished()).resolves.toBe(rows);
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { published: true }, take: 50 }),
      );
    });
  });

  describe('findPublishedBySlug', () => {
    it('returns the published entry', async () => {
      const entry = { id: 'e1', slug: 'use-state', published: true };
      prisma.entry.findFirst.mockResolvedValue(entry);

      await expect(service.findPublishedBySlug('use-state')).resolves.toBe(entry);
    });

    it('throws NotFoundException when missing or unpublished', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.findPublishedBySlug('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const dto = {
      categoryId: 'cat-1',
      title: 'use State',
      kind: 'FUNCTION' as const,
    };

    it('throws NotFoundException when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.entry.create).not.toHaveBeenCalled();
    });

    it('applies defaults, next position, and slugified title', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: 2 } });
      prisma.entry.create.mockResolvedValue({ id: 'e1' });

      await service.create(dto);

      expect(prisma.entry.create).toHaveBeenCalledWith({
        data: {
          categoryId: 'cat-1',
          title: 'use State',
          slug: 'use-state',
          summary: '',
          bodyMdx: '',
          kind: 'FUNCTION',
          difficulty: 'BEGINNER',
          tags: [],
          published: false,
          position: 3,
          template: 'react-ts',
          files: {},
          dependencies: undefined,
        },
      });
    });

    it('uses provided optionals and position 0 when the category is empty', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockResolvedValue({ id: 'e1' });

      await service.create({
        ...dto,
        summary: 'hook',
        bodyMdx: '# md',
        difficulty: 'ADVANCED',
        tags: ['hooks'],
        published: true,
        template: 'vanilla',
        files: { 'App.tsx': 'x' },
        dependencies: { react: '19' },
      });

      expect(prisma.entry.create).toHaveBeenCalledWith({
        data: {
          categoryId: 'cat-1',
          title: 'use State',
          slug: 'use-state',
          summary: 'hook',
          bodyMdx: '# md',
          kind: 'FUNCTION',
          difficulty: 'ADVANCED',
          tags: ['hooks'],
          published: true,
          position: 0,
          template: 'vanilla',
          files: { 'App.tsx': 'x' },
          dependencies: { react: '19' },
        },
      });
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected Prisma codes', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockRejectedValue(knownRequestError('P2010'));

      await expect(service.create(dto)).rejects.toMatchObject({ code: 'P2010' });
    });

    it('rethrows non-Prisma errors', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockRejectedValue(new Error('db down'));

      await expect(service.create(dto)).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    it('recomputes the slug from the title and never sends categoryId', async () => {
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update('e1', {
        title: 'New Title',
        summary: 's',
        bodyMdx: 'b',
        kind: 'COMPONENT',
        difficulty: 'ADVANCED',
        tags: ['a'],
        published: true,
        template: 'vue',
        files: { a: '1' },
        dependencies: { b: '2' },
      });

      expect(prisma.entry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: {
          title: 'New Title',
          slug: 'new-title',
          summary: 's',
          bodyMdx: 'b',
          kind: 'COMPONENT',
          difficulty: 'ADVANCED',
          tags: ['a'],
          published: true,
          template: 'vue',
          files: { a: '1' },
          dependencies: { b: '2' },
        },
      });
    });

    it('sends an empty data object when no field is provided', async () => {
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update('e1', {});

      expect(prisma.entry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: {},
      });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.entry.update.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.update('e1', { summary: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.entry.update.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.update('e1', { title: 'Taken' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unexpected errors', async () => {
      prisma.entry.update.mockRejectedValue(new Error('db down'));

      await expect(service.update('e1', {})).rejects.toThrow('db down');
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      prisma.entry.delete.mockResolvedValue({ id: 'e1' });

      await expect(service.delete('e1')).resolves.toBeUndefined();
      expect(prisma.entry.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.entry.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rethrows unexpected errors', async () => {
      prisma.entry.delete.mockRejectedValue(new Error('db down'));

      await expect(service.delete('e1')).rejects.toThrow('db down');
    });
  });

  describe('findAllAdmin', () => {
    it('returns a paginated envelope including drafts', async () => {
      const items = [{ id: 'e1', published: false }];
      prisma.entry.findMany.mockResolvedValue(items);
      prisma.entry.count.mockResolvedValue(51);

      await expect(service.findAllAdmin(2, 50)).resolves.toEqual({
        items,
        total: 51,
        page: 2,
        limit: 50,
      });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 50 }),
      );
      expect(prisma.entry.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() }),
      );
    });
  });

  describe('findById', () => {
    it('returns the entry', async () => {
      const entry = { id: 'e1', title: 'useState' };
      prisma.entry.findUnique.mockResolvedValue(entry);

      await expect(service.findById('e1')).resolves.toBe(entry);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.entry.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
