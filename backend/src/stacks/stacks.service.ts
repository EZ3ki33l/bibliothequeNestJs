import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStackDto } from './dto/create-stack.dto';
import { UpdateStackDto } from './dto/update-stack.dto';
import { slugify } from '../common/slug';
import { toWriteException } from '../common/prisma-errors';

const SLUG_TAKEN = 'Ce slug est déjà utilisé';

/**
 * Règles métier des stacks (React, Prisma, HeroUI…), le premier niveau du
 * catalogue.
 *
 * Un *service* porte le métier et parle à Prisma ; le contrôleur ne fait que
 * traduire du HTTP. `PrismaService` arrive par le constructeur (injection de
 * dépendances) : c'est ce qui permet de le remplacer par un faux dans les
 * tests, sans démarrer de base de données.
 */
@Injectable()
export class StacksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalogue public : tri d'affichage choisi par l'admin (`position`). */
  findAll() {
    return this.prisma.stack.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      take: 50,
      include: { _count: { select: { categories: true } } },
    });
  }

  /**
   * Liste admin paginée.
   *
   * `Promise.all` lance la page et le total en parallèle : deux requêtes
   * indépendantes, autant ne pas les enchaîner. Le `select` explicite évite de
   * renvoyer des colonnes que l'écran n'affiche pas.
   */
  async findAllAdmin(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.stack.findMany({
        skip,
        take: limit,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: { select: { categories: true } },
        },
      }),
      this.prisma.stack.count(),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Page publique d'un stack : ses catégories et, dans chacune, ses fiches.
   *
   * `where: { published: true }` sur les fiches est essentiel : sans ce filtre,
   * les brouillons de l'admin apparaîtraient dans le catalogue public.
   */
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

  /** Lecture admin par id, pour pré-remplir le formulaire d'édition. */
  async findById(id: string) {
    const stack = await this.prisma.stack.findUnique({ where: { id } });

    if (!stack) {
      throw new NotFoundException();
    }

    return stack;
  }

  /**
   * Le slug et la position sont calculés par le serveur, jamais reçus du
   * client : c'est ce qui garantit des URLs cohérentes et un ordre sans trou.
   */
  async create(dto: CreateStackDto) {
    const { _max } = await this.prisma.stack.aggregate({ _max: { position: true } });

    try {
      return await this.prisma.stack.create({
        data: {
          name: dto.name,
          slug: slugify(dto.name),
          description: dto.description ?? '',
          // Le nouveau stack se place en dernier ; `-1` couvre la table vide.
          position: (_max.position ?? -1) + 1,
        },
      });
    } catch (error) {
      throw toWriteException(error, SLUG_TAKEN);
    }
  }

  /**
   * PATCH partiel : seuls les champs présents dans le DTO sont modifiés.
   *
   * D'où le `data` construit champ par champ plutôt qu'un `...dto` : recopier
   * l'objet reçu écraserait les colonnes absentes avec `undefined`, et
   * laisserait passer n'importe quelle clé envoyée par le client
   * (« mass assignment »).
   */
  async update(id: string, dto: UpdateStackDto) {
    const data: { name?: string; slug?: string; description?: string } = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
      // Renommer, c'est aussi changer l'URL publique : le slug suit le nom.
      data.slug = slugify(dto.name);
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    try {
      return await this.prisma.stack.update({ where: { id }, data });
    } catch (error) {
      throw toWriteException(error, SLUG_TAKEN);
    }
  }

  /** Supprime le stack (la cascade Prisma emporte catégories et fiches). */
  async delete(id: string) {
    try {
      await this.prisma.stack.delete({ where: { id } });
    } catch (error) {
      throw toWriteException(error, SLUG_TAKEN);
    }
  }
}
