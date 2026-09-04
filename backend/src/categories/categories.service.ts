import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../common/slug';
import { toWriteException } from '../common/prisma-errors';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';

const NAME_TAKEN = 'Une catégorie avec un nom trop proche existe déjà dans ce stack';

/** Stack parent tel qu'affiché dans un fil d'Ariane : jamais la ligne entière. */
const PARENT_STACK_SELECT = { select: { id: true, name: true, slug: true } };

/**
 * Règles métier des catégories (Hooks, Formulaires…), le niveau intermédiaire
 * du catalogue : une catégorie appartient à un stack et contient des fiches.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Page publique d'une catégorie, atteinte par le couple de slugs
   * `/stacks/react/categories/hooks`.
   *
   * `findFirst` et non `findUnique` : le slug d'une catégorie n'est unique que
   * *dans son stack*, donc le critère porte sur les deux à la fois.
   */
  async findBySlugs(stackSlug: string, categorySlug: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        slug: categorySlug,
        stack: { slug: stackSlug },
      },
      include: {
        stack: PARENT_STACK_SELECT,
        entries: {
          // Sans ce filtre, les brouillons apparaîtraient dans le catalogue.
          where: { published: true },
          orderBy: { position: 'asc' },
          select: ENTRY_CARD_SELECT,
        },
      },
    });

    if (!category) {
      throw new NotFoundException();
    }

    return category;
  }

  /**
   * Liste admin paginée, triée dans l'ordre d'affichage du catalogue : stack,
   * puis position dans le stack, puis nom.
   */
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
          stack: PARENT_STACK_SELECT,
          _count: { select: { entries: true } },
        },
      }),
      this.prisma.category.count(),
    ]);

    return { items, total, page, limit };
  }

  /** Lecture admin par id, pour pré-remplir le formulaire d'édition. */
  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { stack: PARENT_STACK_SELECT },
    });

    if (!category) {
      throw new NotFoundException();
    }

    return category;
  }

  /**
   * Le stack parent est vérifié **avant** l'écriture : on préfère un 404 clair
   * à une erreur de clé étrangère traduite en 500.
   */
  async create(dto: CreateCategoryDto) {
    const stack = await this.prisma.stack.findUnique({ where: { id: dto.stackId } });

    if (!stack) {
      throw new NotFoundException();
    }

    // Position calculée dans le stack parent : chaque stack a son propre ordre.
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
      throw toWriteException(error, NAME_TAKEN);
    }
  }

  /**
   * PATCH partiel. `stackId` n'est volontairement pas dans `UpdateCategoryDto` :
   * déplacer une catégorie d'un stack à l'autre demanderait de recalculer les
   * positions des deux stacks, ce n'est pas la même opération qu'un renommage.
   */
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
      throw toWriteException(error, NAME_TAKEN);
    }
  }

  /** Supprime la catégorie (la cascade Prisma emporte ses fiches). */
  async delete(id: string) {
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      throw toWriteException(error, NAME_TAKEN);
    }
  }
}
