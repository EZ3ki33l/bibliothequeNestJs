import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import type { EntrySourceDto } from './dto/entry-source.dto';
import { slugify } from '../common/slug';
import { toWriteException } from '../common/prisma-errors';
import { SearchEntriesQueryDto } from './dto/search-entries-query.dto';
import type { AdminEntriesFilters } from './dto/admin-entries-query.dto';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';
import type { AdminRole } from '../generated/prisma/enums';
import { assertCanPublish, assertUnlocked, canManagePublished } from '../common/editorial-rights';
import { dateToDay, dayToDate } from '../common/calendar-day';
import { isQuizEligible } from '../common/quiz-eligibility';
import { EntryAccessService } from '../entry-access/entry-access.service';

const SLUG_TAKEN = 'Ce slug est déjà utilisé';

/** Catégorie + stack de la fiche : de quoi afficher un fil d'Ariane. */
const withTaxonomy = {
  category: {
    include: { stack: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.EntryInclude;

/**
 * Sources d'une fiche telles qu'elles sortent de l'API : dans l'ordre saisi,
 * sans `id`, `entryId` ni `position` (le rang est porté par l'ordre du
 * tableau ; le reste ne sert à aucun client).
 */
const SOURCES_IN_ORDER = {
  orderBy: { position: 'asc' },
  select: {
    title: true,
    url: true,
    publisher: true,
    consultedOn: true,
    licenseName: true,
    licenseUrl: true,
    adapted: true,
  },
} satisfies Prisma.EntrySourceFindManyArgs;

/**
 * Convertit les colonnes `DATE` en `AAAA-MM-JJ` avant de répondre.
 *
 * Prisma lit une colonne `DATE` comme un `Date` à minuit UTC, que JSON
 * écrirait `2026-10-06T00:00:00.000Z` : une heure qui n'existe pas, et que le
 * navigateur décalerait selon son fuseau. La réponse porte donc le jour seul.
 */
function withCalendarDays<
  S extends { consultedOn: Date | null },
  T extends { verifiedOn: Date | null; sources: S[] },
>(entry: T) {
  const { verifiedOn, sources, ...rest } = entry;

  return {
    ...rest,
    verifiedOn: verifiedOn ? dateToDay(verifiedOn) : null,
    sources: sources.map(({ consultedOn, ...source }) => ({
      ...source,
      consultedOn: consultedOn ? dateToDay(consultedOn) : null,
    })),
  };
}

/**
 * Sources reçues → lignes à créer. Le rang est l'index dans le tableau : il
 * est calculé ici, jamais envoyé par le client (comme `position` ailleurs).
 */
function toSourceRows(sources: EntrySourceDto[]): Prisma.EntrySourceCreateWithoutEntryInput[] {
  return sources.map((source, position) => ({
    position,
    title: source.title,
    url: source.url,
    publisher: source.publisher ?? '',
    consultedOn: source.consultedOn ? dayToDate(source.consultedOn) : null,
    licenseName: source.licenseName ?? '',
    licenseUrl: source.licenseUrl ?? '',
    adapted: source.adapted ?? false,
  }));
}

/**
 * Règles métier des fiches, le contenu final du catalogue (un hook, un
 * composant, un concept).
 *
 * Trois publics, trois portes d'entrée :
 * - lectures publiques (`findPublished*`) : uniquement les fiches publiées, et
 *   seulement l'en-tête d'une fiche réservée ;
 * - lecture complète (`findReadableBySlug`) : toute fiche publiée, derrière
 *   `SessionGuard` + `VerifiedEmailGuard` ;
 * - lectures admin (`findAllAdmin`, `findById`) : brouillons inclus, derrière
 *   `SessionGuard` + `AdminGuard`.
 *
 * Les écritures reçoivent le rôle de l'appelant : un `ADMIN` ne publie pas et
 * ne touche pas à une fiche publiée (voir `common/editorial-rights.ts`).
 */
@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entryAccess: EntryAccessService,
  ) {}

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
   * le slug du stack, atteint via la relation `category → stack`. `tag`
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
   * Fiche publique par slug : la même réponse pour tout le monde, sans session.
   *
   * Deux formes, selon la règle d'accès (`EntryAccessService`) :
   * - fiche **en accès libre** : la fiche entière, plus `access: 'free'` ;
   * - fiche **réservée** : son en-tête seul, plus `access: 'reserved'`.
   *
   * La première lecture ne demande que l'en-tête (`ENTRY_CARD_SELECT`, les
   * colonnes d'une carte de liste, déjà publiques). Pour une fiche réservée,
   * **il n'y a pas de seconde lecture** : le corps, les fichiers et les sources
   * ne sont jamais chargés depuis la base, donc ils ne peuvent pas se retrouver
   * dans la réponse par un oubli de filtrage. Choisir ce qui sort par un
   * `select`, plutôt que retirer des champs après coup, est ce qui rend la
   * règle sûre.
   *
   * `quizEligible` est absent de la forme réduite : il se calcule sur le corps,
   * et sa valeur donnerait un indice, même mince, sur la longueur du contenu.
   *
   * `findFirst` car le critère combine le slug et `published`, alors que
   * `findUnique` n'accepte qu'une clé unique seule. Un brouillon reste
   * introuvable (404) ; une fiche réservée répond 200, son existence est
   * publique.
   *
   * Si la règle d'accès échoue, son erreur remonte et rien n'est renvoyé : une
   * fiche n'est jamais traitée comme libre par défaut.
   */
  async findPublishedBySlug(slug: string) {
    const header = await this.prisma.entry.findFirst({
      where: { slug, published: true },
      select: ENTRY_CARD_SELECT,
    });

    if (!header) {
      throw new NotFoundException();
    }

    if (!(await this.entryAccess.isFree(header.id))) {
      return { ...header, access: 'reserved' as const };
    }

    return { ...(await this.findReadableBySlug(slug)), access: 'free' as const };
  }

  /**
   * Fiche publiée **entière** : corps, playground, sources, vérification.
   *
   * Aucun contrôle d'accès ici, exprès : la méthode est appelée soit par
   * `findPublishedBySlug` une fois la fiche établie comme libre, soit par
   * `ReaderEntriesController`, derrière `VerifiedEmailGuard`. Ne pas l'exposer
   * sur une route sans l'un de ces deux contrôles.
   *
   * Les sources sont jointes dans la même requête : elles suivent la
   * visibilité de la fiche, un brouillon ne révèle donc pas les siennes.
   *
   * `quizEligible` dit si un examen existe pour cette fiche. La règle reste
   * celle de `common/quiz-eligibility.ts`, le navigateur ne la recopie pas.
   */
  async findReadableBySlug(slug: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { slug, published: true },
      omit: { quizQuestions: true },
      include: { ...withTaxonomy, sources: SOURCES_IN_ORDER },
    });

    if (!entry) {
      throw new NotFoundException();
    }

    return { ...withCalendarDays(entry), quizEligible: isQuizEligible(entry.bodyMdx) };
  }

  /**
   * Liste admin paginée, dans l'ordre d'affichage du catalogue, brouillons
   * compris.
   *
   * `q` (après trim) filtre sur le titre, casse ignorée ; vide = absent.
   * `status`, `stackId`, `categoryId` et `pathId` s'ajoutent au `where` comme
   * autant de clés, que Prisma combine en ET. `stackId` et `pathId` ne sont pas
   * des colonnes d'`Entry` : ils passent par les relations `category` et
   * `pathSteps`. Un id inconnu ne lève rien, la liste est simplement vide.
   *
   * Le même `where` sert à la liste et au `count`, sinon la pagination
   * annoncerait un total qui ne correspond pas aux lignes filtrées.
   */
  async findAllAdmin(page: number, limit: number, filters: AdminEntriesFilters = {}) {
    const skip = (page - 1) * limit;
    const where: Prisma.EntryWhereInput = {};

    const search = filters.q?.trim();
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (filters.status) {
      where.published = filters.status === 'published';
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.stackId) {
      where.category = { stackId: filters.stackId };
    }
    if (filters.pathId) {
      // `some` : la fiche est une étape d'au moins un module de ce parcours.
      where.pathSteps = { some: { pathId: filters.pathId } };
    }

    const [items, total] = await Promise.all([
      this.prisma.entry.findMany({
        where,
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
      this.prisma.entry.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Lecture admin par id : tous les champs éditables du formulaire, brouillon
   * compris, dont les sources et la vérification. `quizQuestions`, `position`
   * et les horodatages ne sont pas éditables, donc absents du `select`.
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
        verifiedOn: true,
        verifiedVersion: true,
        sources: SOURCES_IN_ORDER,
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

    return withCalendarDays(entry);
  }

  /**
   * Création. Tout ce qui n'est pas fourni prend un défaut explicite côté
   * serveur — dont `published: false` : une fiche naît brouillon, on ne publie
   * jamais par accident. Créer directement publié est réservé au `SUPER_ADMIN`.
   */
  async create(dto: CreateEntryDto, role: AdminRole) {
    assertCanPublish(role, dto.published);

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
          verifiedOn: dto.verifiedOn ? dayToDate(dto.verifiedOn) : undefined,
          verifiedVersion: dto.verifiedVersion,
          // Écriture imbriquée : les sources sont créées dans la même
          // transaction que la fiche. Tout est enregistré, ou rien.
          sources: dto.sources ? { create: toSourceRows(dto.sources) } : undefined,
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
   *
   * Pour un `ADMIN` : 403 si la fiche est publiée, ou si le PATCH demande sa
   * publication. Sources, date de vérification et version font partie de la
   * fiche : elles passent par le même contrôle, sans règle propre.
   *
   * `sources` absent : la liste n'est pas touchée (la publication depuis la
   * liste n'envoie que `published`). Présent : la liste est **remplacée**, par
   * une écriture imbriquée qui s'exécute dans la transaction de la mise à
   * jour — aucune liste à moitié enregistrée.
   *
   * `verifiedOn` n'avance que s'il est envoyé : `undefined` le laisse tel
   * quel, `null` l'efface.
   */
  async update(id: string, dto: UpdateEntryDto, role: AdminRole) {
    assertCanPublish(role, dto.published);
    await this.assertUnlocked(id, role);

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
    if (dto.verifiedOn !== undefined) {
      data.verifiedOn = dto.verifiedOn === null ? null : dayToDate(dto.verifiedOn);
    }
    if (dto.verifiedVersion !== undefined) data.verifiedVersion = dto.verifiedVersion;
    if (dto.sources !== undefined) {
      data.sources = { deleteMany: {}, create: toSourceRows(dto.sources) };
    }

    try {
      return await this.prisma.entry.update({ where: { id }, data });
    } catch (error) {
      throw toWriteException(error, SLUG_TAKEN);
    }
  }

  /**
   * Supprime la fiche (la cascade emporte traces de lecture et tentatives).
   * Un `ADMIN` ne supprime qu'un brouillon.
   */
  async delete(id: string, role: AdminRole) {
    await this.assertUnlocked(id, role);

    try {
      await this.prisma.entry.delete({ where: { id } });
    } catch (error) {
      throw toWriteException(error, SLUG_TAKEN);
    }
  }

  /**
   * 403 si la fiche est publiée et que le rôle n'y a pas droit.
   *
   * Une fiche introuvable n'est pas traitée ici : l'écriture qui suit lève
   * `P2025`, traduit en 404 comme pour tout autre id inconnu. La lecture est
   * épargnée au `SUPER_ADMIN`, qui a tous les droits.
   */
  private async assertUnlocked(id: string, role: AdminRole) {
    if (canManagePublished(role)) {
      return;
    }

    const entry = await this.prisma.entry.findUnique({
      where: { id },
      select: { published: true },
    });
    assertUnlocked(role, entry?.published ?? false);
  }
}
