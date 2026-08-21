import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { slugify } from '../common/slug';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

const withTaxonomy = {
  category: {
    include: { stack: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.EntryInclude;

@Injectable()
export class EntriesService {
  constructor(private readonly prisma: PrismaService) {}

  findPublished() {
    return this.prisma.entry.findMany({
      where: { published: true },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
      take: 50,
      include: withTaxonomy,
    });
  }

  async findPublishedBySlug(slug: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { slug, published: true },
      include: withTaxonomy,
    });

    if (!entry) {
      throw new NotFoundException();
    }
    return entry;
  }

  async create(dto: CreateEntryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException();
    }
    const { _max } = await this.prisma.entry.aggregate({
      where: { categoryId: dto.categoryId },
      _max: { position: true },
    });
    try {
      return await this.prisma.entry.create({
        data: {
          categoryId: dto.categoryId,
          title: dto.title,
          slug: slugify(dto.title),
          summary: dto.summary ?? '',
          bodyMdx: dto.bodyMdx ?? '',
          kind: dto.kind,
          difficulty: dto.difficulty ?? 'BEGINNER',
          tags: dto.tags ?? [],
          published: dto.published,
          position: (_max.position ?? -1) + 1,
          template: dto.template ?? 'react-ts',
          files: dto.files,
          dependencies: dto.dependencies,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce slug est déjà utilisé');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateEntryDto) {
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException();
      }
    }
    const data: {
      categoryId?: string;
      title?: string;
      slug?: string;
      summary?: string;
      bodyMdx?: string;
      kind?: CreateEntryDto['kind'];
      difficulty?: NonNullable<CreateEntryDto['difficulty']>;
      tags?: string[];
      published?: boolean;
      template?: string;
      files?: Record<string, string>;
      dependencies?: Record<string, string>;
    } = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.title !== undefined) {
      data.title = dto.title;
      data.slug = slugify(dto.title);
    }
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.bodyMdx !== undefined) data.bodyMdx = dto.bodyMdx;
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.published !== undefined) data.published = dto.published;
    if (dto.template !== undefined) data.template = dto.template;
    if (dto.files !== undefined) data.files = dto.files;
    if (dto.dependencies !== undefined) data.dependencies = dto.dependencies;
    try {
      return await this.prisma.entry.update({ where: { id }, data });
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
      await this.prisma.entry.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
