import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { slugify } from '../common/slug';
import { PrismaClientKnownRequestError } from '../generated/prisma/internal/prismaNamespace';
import { Prisma } from '../generated/prisma/client';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlugs(stackSlug: string, categorySlug: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        slug: categorySlug,
        stack: { slug: stackSlug },
      },
      include: {
        stack: true,
        entries: {
          where: { published: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException();
    }
    return category;
  }

  async findAllAdmin(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        skip,
        take: limit,
        orderBy: [{ stack: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          stack: { select: { id: true, name: true, slug: true } },
          _count: { select: { entries: true } },
        },
      }),
      this.prisma.category.count(),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { stack: { select: { id: true, name: true, slug: true } } },
    });

    if (!category) {
      throw new NotFoundException();
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const stack = await this.prisma.stack.findUnique({
      where: { id: dto.stackId },
    });
    if (!stack) {
      throw new NotFoundException();
    }
    const { _max } = await this.prisma.category.aggregate({
      where: { stackId: dto.stackId },
      _max: { position: true },
    });

    try {
      return await this.prisma.category.create({
        data: {
          stackId: dto.stackId,
          name: dto.name,
          slug: slugify(dto.name),
          description: dto.description ?? '',
          position: (_max.position ?? -1) + 1,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Une catégorie avec un nom trop proche existe déjà dans ce stack',
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const data: { name?: string; slug?: string; description?: string } = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = slugify(dto.name);
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    try {
      return await this.prisma.category.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException();
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Une catégorie avec un nom trop proche existe déjà dans ce stack',
        );
      }
      throw error;
    }
  }
  async delete(id: string) {
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
