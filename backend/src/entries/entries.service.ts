import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { slugify } from '../common/slug';
import { toWriteException } from '../common/prisma-errors';
import { SearchEntriesQueryDto } from './dto/search-entries-query.dto';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';

const SLUG_TAKEN = 'Ce slug est déjà utilisé';

/** Catégorie + stack de la fiche : de quoi afficher un fil d'Ariane. */
const withTaxonomy = {
  category: {
    include: { stack: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.EntryInclude;

/**
 * Règles métier des fiches, le contenu final du catalogue (un hook, un
 * composant, un concept).
 *
 * Deux publics, deux portes d'entrée :
 * - lectures publiques (`findPublished*`) : uniquement les fiches publiées ;
 * - lectures admin (`findAllAdmin`, `findById`) : brouillons inclus, derrière
 *   `SessionGuard` + `AdminGuard`.
 */
@Injectable()
export class EntriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste publique paginée. Toujours `published: true` : un admin qui appelle
   * cet endpoint ne voit pas plus de fiches qu'un visiteur (les brouillons
   * restent sur `/admin/entries`).
   *
   * `q` (après trim) : si la chaîne est vide, elle est traitée comme absente.
   * Sinon, un `OR` interne cherche dans le titre, le résumé (`contains`, casse
   * ignorée) et les tags (`has` = tag exact). On ne cherche **pas** dans `bodyMdx`.
   *
   * `kind` / `difficulty` / `stack` / `tag` s'ajoutent au `where` comme autant
   * de clés : Prisma les combine en ET (intersection). Un filtre absent = pas
   * de clé = pas de contrainte. `stack` n'est pas une colonne d'`Entry` : c'est
   * le slug du parcours, atteint via la relation `category → stack`. `tag`
   * filtre sur un tag **exact** (`has`) : suivre un tag depuis une fiche doit
   * donner un ensemble net, pas une recherche floue comme `q`.
   */
  async findPublished(dto: SearchEntriesQueryDto) {
    const { page, limit } = dto;
    const skip = (page - 1) * limit;
    const q = dto.q?.trim();

    const where: Prisma.EntryWhereInput = { published: true };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    if (dto.kind) {
      where.kind = dto.kind;
    }

    if (dto.difficulty) {
      where.difficulty = dto.difficulty;
    }

    if (dto.stack) {
      // Slug inconnu → aucune fiche ne matche, la liste est simplement vide
      // (pas d'erreur : ce n'est pas une panne, juste zéro résultat).
      where.category = { stack: { slug: dto.stack } };
    }

    if (dto.tag) {
      const tag = dto.tag.trim();
      // Un tag réduit à des espaces = pas de filtre (comme `q`).
      if (tag) {
        where.tags = { has: tag };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.entry.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ position: 'asc' }, { title: 'asc' }],
        select: ENTRY_CARD_SELECT,
      }),
      this.prisma.entry.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Fiche publique par slug. `findFirst` car le critère combine le slug et
   * `published`, alors que `findUnique` n'accepte qu'une clé unique seule.
   */
  async findPublishedBySlug(slug: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { slug, published: true },
      omit: { quizQuestions: true },
      include: withTaxonomy,
    });

    if (!entry) {
      throw new NotFoundException();
    }

    return entry;
  }

  /** Liste admin paginée, dans l'ordre d'affichage du catalogue. */
  async findAllAdmin(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.entry.findMany({
        skip,
        take: limit,
        orderBy: [
          { category: { stack: { position: 'asc' } } },
          { category: { position: 'asc' } },
          { position: 'asc' },
          { title: 'asc' },
        ],
        // Une ligne de liste n'affiche pas le corps de la fiche.
        select: {
          id: true,
          title: true,
          slug: true,
          kind: true,
          published: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              stack: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.entry.count(),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Lecture admin par id : tous les champs éditables du formulaire, brouillon
   * compris. `quizQuestions`, `position` et les horodatages ne sont pas
   * éditables, donc absents du `select`.
   */
  async findById(id: string) {
    const entry = await this.prisma.entry.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        bodyMdx: true,
        kind: true,
        difficulty: true,
        tags: true,
        published: true,
        template: true,
        files: true,
        dependencies: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            stack: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException();
    }

    return entry;
  }

  /**
   * Création. Tout ce qui n'est pas fourni prend un défaut explicite côté
   * serveur — dont `published: false` : une fiche naît brouillon, on ne publie
   * jamais par accident.
   */
  async create(dto: CreateEntryDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });

    if (!category) {
      throw new NotFoundException();
    }

    // Position calculée dans la catégorie parente.
    const { _max } = await this.prisma.entry.aggregate({
      where: { categoryId: dto.categoryId },
      _max: { position: true },
    });

    try {
      return await this.prisma.entry.create({
        data: {
          categoryId: dto.categoryId,
          title: dto.title,
          // Le slug d'une fiche est unique dans tout le catalogue : l'URL
          // publique est `/entries/:slug`, sans le stack ni la catégorie.
          slug: slugify(dto.title),
          summary: dto.summary ?? '',
          bodyMdx: dto.bodyMdx ?? '',
          kind: dto.kind,
          difficulty: dto.difficulty ?? 'BEGINNER',
          tags: dto.tags ?? [],
          published: dto.published ?? false,
          position: (_max.position ?? -1) + 1,
          template: dto.template ?? 'react-ts',
          files: dto.files ?? {},
          dependencies: dto.dependencies,
        },
      });
    } catch (error) {
      throw toWriteException(error, SLUG_TAKEN);
    }
  }

  /**
   * PATCH partiel : seuls les champs présents sont écrits.
   *
   * `Prisma.EntryUpdateInput` évite de recopier ici la liste des colonnes du
   * modèle — une liste à la main se désynchronise dès le prochain champ ajouté
   * au schéma.
   */
  async update(id: string, dto: UpdateEntryDto) {
    const data: Prisma.EntryUpdateInput = {};

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
      throw toWriteException(error, SLUG_TAKEN);
    }
  }

  /** Supprime la fiche (la cascade emporte cartes de révision et tentatives). */
  async delete(id: string) {
    try {
      await this.prisma.entry.delete({ where: { id } });
    } catch (error) {
      throw toWriteException(error, SLUG_TAKEN);
    }
  }
}
