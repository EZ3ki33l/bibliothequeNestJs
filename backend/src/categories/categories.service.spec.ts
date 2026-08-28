import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CategoriesService } from './categories.service';

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prisma = {
    stack: {
      findUnique: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
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
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CategoriesService);
  });

  describe('findBySlugs', () => {
    it('returns the category with published entries only', async () => {
      const category = { id: 'c1', slug: 'hooks' };
      prisma.category.findFirst.mockResolvedValue(category);

      await expect(service.findBySlugs('react', 'hooks')).resolves.toBe(category);
      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'hooks', stack: { slug: 'react' } },
          include: expect.objectContaining({
            entries: expect.objectContaining({ where: { published: true } }),
          }),
        }),
      );
    });

    it('throws NotFoundException when missing', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.findBySlugs('react', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAllAdmin', () => {
    it('returns a paginated envelope', async () => {
      const items = [{ id: 'c1' }];
      prisma.category.findMany.mockResolvedValue(items);
      prisma.category.count.mockResolvedValue(12);

      await expect(service.findAllAdmin(2, 10)).resolves.toEqual({
        items,
        total: 12,
        page: 2,
        limit: 10,
      });
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('findById', () => {
    it('returns the category', async () => {
      const category = { id: 'c1', name: 'Hooks' };
      prisma.category.findUnique.mockResolvedValue(category);

      await expect(service.findById('c1')).resolves.toBe(category);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = { stackId: 'stack-1', name: 'React Hooks' };

    it('throws NotFoundException when the stack does not exist', async () => {
      prisma.stack.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('applies defaults, next position, and slugified name', async () => {
      prisma.stack.findUnique.mockResolvedValue({ id: 'stack-1' });
      prisma.category.aggregate.mockResolvedValue({ _max: { position: 1 } });
      prisma.category.create.mockResolvedValue({ id: 'c1' });

      await service.create(dto);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          stackId: 'stack-1',
          name: 'React Hooks',
          slug: 'react-hooks',
          description: '',
          position: 2,
        },
      });
    });

    it('uses the provided description and position 0 when the stack is empty', async () => {
      prisma.stack.findUnique.mockResolvedValue({ id: 'stack-1' });
      prisma.category.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.category.create.mockResolvedValue({ id: 'c1' });

      await service.create({ ...dto, description: 'API React' });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          stackId: 'stack-1',
          name: 'React Hooks',
          slug: 'react-hooks',
          description: 'API React',
          position: 0,
        },
      });
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.stack.findUnique.mockResolvedValue({ id: 'stack-1' });
      prisma.category.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.category.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.create(dto)).rejects.toThrow(
        'Une catégorie avec un nom trop proche existe déjà dans ce stack',
      );
    });

    it('rethrows unexpected errors', async () => {
      prisma.stack.findUnique.mockResolvedValue({ id: 'stack-1' });
      prisma.category.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.category.create.mockRejectedValue(new Error('db down'));

      await expect(service.create(dto)).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    it('recomputes the slug from the name', async () => {
      prisma.category.update.mockResolvedValue({ id: 'c1' });

      await service.update('c1', { name: 'New Name', description: 'd' });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: 'New Name', slug: 'new-name', description: 'd' },
      });
    });

    it('sends an empty data object when no field is provided', async () => {
      prisma.category.update.mockResolvedValue({ id: 'c1' });

      await service.update('c1', {});

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {},
      });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.category.update.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.update('c1', { description: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.category.update.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.update('c1', { name: 'Taken' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unexpected errors', async () => {
      prisma.category.update.mockRejectedValue(new Error('db down'));

      await expect(service.update('c1', {})).rejects.toThrow('db down');
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      prisma.category.delete.mockResolvedValue({ id: 'c1' });

      await expect(service.delete('c1')).resolves.toBeUndefined();
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.category.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rethrows unexpected errors', async () => {
      prisma.category.delete.mockRejectedValue(new Error('db down'));

      await expect(service.delete('c1')).rejects.toThrow('db down');
    });
  });
});
