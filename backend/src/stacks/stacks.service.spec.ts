import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { StackService } from './stacks.service';

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

describe('StackService', () => {
  let service: StackService;
  const prisma = {
    stack: {
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
      providers: [StackService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(StackService);
  });

  describe('findAll', () => {
    it('lists stacks with category counts', async () => {
      const rows = [{ id: 's1' }];
      prisma.stack.findMany.mockResolvedValue(rows);

      await expect(service.findAll()).resolves.toBe(rows);
      expect(prisma.stack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          include: { _count: { select: { categories: true } } },
        }),
      );
    });
  });

  describe('findAllAdmin', () => {
    it('returns a paginated envelope', async () => {
      const items = [{ id: 's1' }];
      prisma.stack.findMany.mockResolvedValue(items);
      prisma.stack.count.mockResolvedValue(3);

      await expect(service.findAllAdmin(2, 10)).resolves.toEqual({
        items,
        total: 3,
        page: 2,
        limit: 10,
      });
      expect(prisma.stack.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('findBySlug', () => {
    it('returns the stack with published entries only', async () => {
      const stack = { id: 's1', slug: 'react' };
      prisma.stack.findUnique.mockResolvedValue(stack);

      await expect(service.findBySlug('react')).resolves.toBe(stack);
      expect(prisma.stack.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'react' },
          include: expect.objectContaining({
            categories: expect.objectContaining({
              include: expect.objectContaining({
                entries: expect.objectContaining({ where: { published: true } }),
              }),
            }),
          }),
        }),
      );
    });

    it('throws NotFoundException when missing', async () => {
      prisma.stack.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findById', () => {
    it('returns the stack', async () => {
      const stack = { id: 's1', name: 'React' };
      prisma.stack.findUnique.mockResolvedValue(stack);

      await expect(service.findById('s1')).resolves.toBe(stack);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.stack.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('applies defaults, next position, and slugified name', async () => {
      prisma.stack.aggregate.mockResolvedValue({ _max: { position: 4 } });
      prisma.stack.create.mockResolvedValue({ id: 's1' });

      await service.create({ name: 'Next.js' });

      expect(prisma.stack.create).toHaveBeenCalledWith({
        data: {
          name: 'Next.js',
          slug: 'next-js',
          description: '',
          position: 5,
        },
      });
    });

    it('uses the provided description and position 0 when empty', async () => {
      prisma.stack.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.stack.create.mockResolvedValue({ id: 's1' });

      await service.create({ name: 'Vue', description: 'UI' });

      expect(prisma.stack.create).toHaveBeenCalledWith({
        data: {
          name: 'Vue',
          slug: 'vue',
          description: 'UI',
          position: 0,
        },
      });
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.stack.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.stack.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.create({ name: 'React' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected Prisma codes', async () => {
      prisma.stack.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.stack.create.mockRejectedValue(knownRequestError('P2010'));

      await expect(service.create({ name: 'React' })).rejects.toMatchObject({ code: 'P2010' });
    });

    it('rethrows non-Prisma errors', async () => {
      prisma.stack.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.stack.create.mockRejectedValue(new Error('db down'));

      await expect(service.create({ name: 'React' })).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    it('recomputes the slug from the name', async () => {
      prisma.stack.update.mockResolvedValue({ id: 's1' });

      await service.update('s1', { name: 'New Name', description: 'd' });

      expect(prisma.stack.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { name: 'New Name', slug: 'new-name', description: 'd' },
      });
    });

    it('sends an empty data object when no field is provided', async () => {
      prisma.stack.update.mockResolvedValue({ id: 's1' });

      await service.update('s1', {});

      expect(prisma.stack.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: {},
      });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.stack.update.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.update('s1', { description: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.stack.update.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.update('s1', { name: 'Taken' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unexpected errors', async () => {
      prisma.stack.update.mockRejectedValue(new Error('db down'));

      await expect(service.update('s1', {})).rejects.toThrow('db down');
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      prisma.stack.delete.mockResolvedValue({ id: 's1' });

      await expect(service.delete('s1')).resolves.toBeUndefined();
      expect(prisma.stack.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.stack.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rethrows unexpected errors', async () => {
      prisma.stack.delete.mockRejectedValue(new Error('db down'));

      await expect(service.delete('s1')).rejects.toThrow('db down');
    });
  });
});
