import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStackDto } from './dto/create-stack.dto';
import { slugify } from '../common/slug';
import { Prisma } from '../generated/prisma/client';
import { UpdateStackDto } from './dto/update-stack.dto';

@Injectable()
export class StackService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.stack.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      take: 50,
      include: { _count: { select: { categories: true } } },
    });
  }

  async findBySlug(slug: string) {
    const stack = await this.prisma.stack.findUnique({
      where: { slug },
      include: {
        categories: {
          orderBy: { position: 'asc' },
          include: {
            entries: {
              where: { published: true },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                slug: true,
                summary: true,
                kind: true,
                difficulty: true,
                tags: true,
              },
            },
          },
        },
      },
    });

    if (!stack) {
      throw new NotFoundException();
    }

    return stack;
  }

  async findById(id: string) {
    const stack = await this.prisma.stack.findUnique({ where: { id } });

    if (!stack) {
      throw new NotFoundException();
    }
    return stack;
  }

  async create(dto: CreateStackDto) {
    const { _max } = await this.prisma.stack.aggregate({
      _max: { position: true },
    });

    try {
      return await this.prisma.stack.create({
        data: {
          name: dto.name,
          slug: slugify(dto.name),
          description: dto.description ?? '',
          position: (_max.position ?? -1) + 1,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce slug est déjà utilisé');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateStackDto) {
    const data: { name?: string; slug?: string; description?: string } = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = slugify(dto.name);
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    try {
      return await this.prisma.stack.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException();
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce slug est déjà utilisé');
      }
      throw error;
    }
  }

  async delete(id: string) {
    try {
      await this.prisma.stack.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
