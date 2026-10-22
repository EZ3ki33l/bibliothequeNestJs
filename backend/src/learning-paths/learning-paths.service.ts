import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';
import { slugify } from '../common/slug';
import { toWriteException } from '../common/prisma-errors';
import type { AdminRole } from '../generated/prisma/enums';
import { assertCanPublish, assertUnlocked, canManagePublished } from '../common/editorial-rights';
import { CreateLearningPathDto } from './dto/create-learning-path.dto';
import { UpdateLearningPathDto } from './dto/update-learning-path.dto';
import { CreatePathModuleDto } from './dto/create-path-module.dto';
import { UpdatePathModuleDto } from './dto/update-path-module.dto';
import { CreatePathStepDto } from './dto/create-path-step.dto';
import { UpdatePathStepDto } from './dto/update-path-step.dto';

/**
 * Plafonds de composition. La page publique d'un parcours n'est pas paginée
 * (on veut voir tout le plan d'un coup) : sa taille est donc bornée **à
 * l'écriture**, ce qui borne aussi le calcul de progression.
 */
export const MAX_MODULES_PER_PATH = 30;
export const MAX_STEPS_PER_PATH = 200;
export const MAX_SUB_PATHS_PER_PATH = 30;

const PATH_NAME_TAKEN = 'Un parcours avec un nom trop proche existe déjà';
const STEP_DUPLICATE = 'Cette fiche est déjà dans ce parcours';
const COMPOSITION_CHANGED =
  'La composition du parcours a changé depuis le dernier chargement : recharger avant de réordonner';
const MODULES_OR_SUB_PATHS =
  'Un parcours contient soit des modules, soit des sous-parcours, pas les deux';
const ONE_LEVEL_ONLY =
  'Un seul niveau de sous-parcours : un sous-parcours ne contient pas de sous-parcours';
const ALREADY_ATTACHED = 'Ce parcours est déjà rattaché à un parcours parent';
const SELF_ATTACH = 'Un parcours ne peut pas être son propre sous-parcours';
const PARENT_NOT_EMPTY =
  'Ce parcours contient des sous-parcours : les détacher ou les supprimer d’abord';

/**
 * Filtre « fiche visible » d'une étape. Une étape dont la fiche est un
 * brouillon n'est ni affichée ni comptée côté public : elle réapparaît d'elle
 * même si la fiche est republiée, sans toucher au parcours.
 */
export const VISIBLE_STEP_WHERE = {
  entry: { published: true },
} satisfies Prisma.PathStepWhereInput;

/**
 * Parcours **visibles** : publiés et, pour un sous-parcours, dont le parent est
 * publié aussi. Seule définition de « visible » : page publique, progression,
 * parcours commencés et accès libre (`EntryAccessService`) la partagent, donc
 * dépublier un parent ferme d'un coup tout son contenu (fail closed).
 */
export const PUBLISHED_PATHS_WHERE = {
  published: true,
  OR: [{ parentId: null }, { parent: { published: true } }],
} satisfies Prisma.LearningPathWhereInput;

/**
 * Parcours de la liste publique : visibles et de premier niveau. Partagé avec
 * la progression : sa liste doit paginer les **mêmes** parcours, dans le même
 * ordre, pour que le SPA fusionne les deux pages.
 */
export const LISTED_PATHS_WHERE = {
  published: true,
  parentId: null,
} satisfies Prisma.LearningPathWhereInput;

/** Ordre d'un parcours parmi ses frères (premier niveau, ou sous-parcours d'un parent). */
export const PUBLISHED_PATHS_ORDER = [
  { position: 'asc' },
  { name: 'asc' },
] satisfies Prisma.LearningPathOrderByWithRelationInput[];

/** Sous-parcours visibles d'un parent visible : il suffit qu'ils soient publiés. */
export const VISIBLE_SUB_PATH_WHERE = { published: true } satisfies Prisma.LearningPathWhereInput;

/**
 * Plan public d'un parcours : modules puis étapes, chacun dans son ordre.
 *
 * `entry` reprend `ENTRY_CARD_SELECT` : jamais `bodyMdx`, `files` ni
 * `quizQuestions` dans une réponse publique.
 */
const PUBLIC_PATH_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  modules: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      steps: {
        where: VISIBLE_STEP_WHERE,
        orderBy: { position: 'asc' },
        select: { id: true, optional: true, entry: { select: ENTRY_CARD_SELECT } },
      },
    },
  },
  // Les frères servent à trouver le sous-parcours suivant.
  parent: {
    select: {
      name: true,
      slug: true,
      children: {
        where: VISIBLE_SUB_PATH_WHERE,
        orderBy: PUBLISHED_PATHS_ORDER,
        select: { id: true, name: true, slug: true },
      },
    },
  },
  children: {
    where: VISIBLE_SUB_PATH_WHERE,
    orderBy: PUBLISHED_PATHS_ORDER,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { steps: { where: VISIBLE_STEP_WHERE } } },
    },
  },
} satisfies Prisma.LearningPathSelect;

/**
 * Détail admin d'un parcours : **toutes** les étapes, brouillons compris, avec
 * `entry.published` pour que l'éditeur signale celles qui restent masquées
 * côté public. Toujours pas de `bodyMdx` : l'éditeur n'en a pas besoin.
 */
const ADMIN_PATH_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  published: true,
  parent: { select: { id: true, name: true, slug: true, published: true } },
  children: {
    orderBy: PUBLISHED_PATHS_ORDER,
    select: {
      id: true,
      name: true,
      slug: true,
      published: true,
      _count: { select: { modules: true, steps: true } },
    },
  },
  modules: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      steps: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          optional: true,
          entry: {
            select: {
              id: true,
              title: true,
              slug: true,
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
          },
        },
      },
    },
  },
} satisfies Prisma.LearningPathSelect;

/** Vrai si `received` contient exactement les mêmes ids que `current`, dans un ordre quelconque. */
function isSameIdSet(current: string[], received: string[]): boolean {
  const receivedSet = new Set(received);
  return (
    receivedSet.size === received.length &&
    received.length === current.length &&
    current.every((id) => receivedSet.has(id))
  );
}

/**
 * Parcours guidés : lectures publiques et composition admin.
 *
 * Ce service ne manipule que du **contenu** (parcours, modules, étapes) et ne
 * reçoit jamais de `userId`. Tout ce qui dépend du compte connecté vit dans
 * `PathProgressService` : la séparation rend la revue de sécurité évidente.
 *
 * Les écritures reçoivent le rôle de l'appelant : un `ADMIN` ne compose que
 * des parcours brouillons. Publier, et toute écriture sur un parcours publié
 * (lui-même, ses modules, ses étapes, leur ordre), sont réservés au
 * `SUPER_ADMIN` (voir `common/editorial-rights.ts`).
 */
@Injectable()
export class LearningPathsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste publique paginée des parcours publiés, dans l'ordre choisi par
   * l'administration.
   *
   * `stepCount` ne compte que les étapes dont la fiche est publiée : le nombre
   * affiché sur la carte correspond à ce que la page du parcours montrera.
   * Un parent n'a pas d'étape à lui : son `stepCount` additionne celles de ses
   * sous-parcours visibles. Les sous-parcours ne sont pas listés ici.
   */
  async findPublished(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = LISTED_PATHS_WHERE;

    const [rows, total] = await Promise.all([
      this.prisma.learningPath.findMany({
        where,
        skip,
        take: limit,
        orderBy: PUBLISHED_PATHS_ORDER,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: { select: { steps: { where: VISIBLE_STEP_WHERE } } },
          children: {
            where: VISIBLE_SUB_PATH_WHERE,
            select: { _count: { select: { steps: { where: VISIBLE_STEP_WHERE } } } },
          },
        },
      }),
      this.prisma.learningPath.count({ where }),
    ]);

    const items = rows.map(({ _count, children, ...path }) => ({
      ...path,
      stepCount: children.reduce((sum, child) => sum + child._count.steps, _count.steps),
      subPathCount: children.length,
    }));
    return { items, total, page, limit };
  }

  /**
   * Plan d'un parcours publié, réduit à ce qu'un visiteur peut ouvrir.
   *
   * Brouillon et slug inconnu donnent le **même** 404 : la réponse ne révèle
   * pas qu'un parcours en préparation existe sous ce nom.
   *
   * Un module dont aucune étape n'est visible est retiré : afficher un titre
   * de module vide n'apprendrait rien. Un parcours sans module visible reste
   * une réponse valide (`modules: []`), que la page présente comme « en
   * préparation ».
   *
   * Un sous-parcours dont le parent est en brouillon donne le même 404. Sa
   * réponse nomme son parent et le sous-parcours visible suivant ; celle d'un
   * parent liste ses sous-parcours visibles (`modules` est alors vide).
   */
  async findPublishedBySlug(slug: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: { slug, ...PUBLISHED_PATHS_WHERE },
      select: PUBLIC_PATH_SELECT,
    });

    if (!path) {
      throw new NotFoundException();
    }

    const { parent, children, ...rest } = path;
    const siblings = parent?.children ?? [];
    const index = siblings.findIndex((sibling) => sibling.id === path.id);
    const next = index === -1 ? undefined : siblings[index + 1];

    return {
      ...rest,
      modules: path.modules.filter((module) => module.steps.length > 0),
      parent: parent ? { name: parent.name, slug: parent.slug } : null,
      nextSubPath: next ? { name: next.name, slug: next.slug } : null,
      subPaths: children.map(({ _count, ...child }) => ({ ...child, stepCount: _count.steps })),
    };
  }

  // ---------------------------------------------------------------------------
  // Administration : parcours
  // ---------------------------------------------------------------------------

  /** Liste admin paginée, brouillons compris. */
  async findAllAdmin(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.learningPath.findMany({
        skip,
        take: limit,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          published: true,
          position: true,
          parent: { select: { id: true, name: true } },
          _count: { select: { modules: true, steps: true, children: true } },
        },
      }),
      this.prisma.learningPath.count(),
    ]);

    const items = rows.map(({ _count, ...path }) => ({
      ...path,
      moduleCount: _count.modules,
      stepCount: _count.steps,
      subPathCount: _count.children,
    }));
    return { items, total, page, limit };
  }

  async findAdminDetail(id: string) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id },
      select: ADMIN_PATH_SELECT,
    });

    if (!path) {
      throw new NotFoundException();
    }

    const { children, ...rest } = path;
    return {
      ...rest,
      subPaths: children.map(({ _count, ...child }) => ({
        ...child,
        moduleCount: _count.modules,
        stepCount: _count.steps,
      })),
    };
  }

  /**
   * Crée un parcours **brouillon**, placé en fin de liste. Le slug est calculé
   * depuis le nom ; un slug déjà pris donne 409 plutôt qu'une erreur de base.
   */
  async create(dto: CreateLearningPathDto) {
    const position = await this.nextPosition(null);

    try {
      const created = await this.prisma.learningPath.create({
        data: {
          name: dto.name,
          slug: slugify(dto.name),
          description: dto.description ?? '',
          position,
        },
        select: { id: true },
      });
      return await this.findAdminDetail(created.id);
    } catch (error) {
      throw toWriteException(error, PATH_NAME_TAKEN);
    }
  }

  /**
   * PATCH partiel : renommer (le slug suit), décrire, publier ou dépublier.
   * Dépublier ne touche ni aux modules, ni aux étapes, ni aux fiches.
   */
  async update(id: string, dto: UpdateLearningPathDto, role: AdminRole) {
    assertCanPublish(role, dto.published);
    await this.assertUnlocked(id, role);

    const data: Prisma.LearningPathUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = slugify(dto.name);
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.published !== undefined) {
      data.published = dto.published;
    }

    try {
      await this.prisma.learningPath.update({ where: { id }, data, select: { id: true } });
    } catch (error) {
      throw toWriteException(error, PATH_NAME_TAKEN);
    }

    return this.findAdminDetail(id);
  }

  /**
   * Supprime le parcours ; modules et étapes partent en cascade, les fiches
   * restent. Un parent qui a encore des sous-parcours est refusé (409) : la
   * cascade effacerait des parcours entiers, un détachement automatique les
   * publierait seuls. La base refuse aussi (`onDelete: Restrict`).
   */
  async delete(id: string, role: AdminRole) {
    await this.assertUnlocked(id, role);

    if ((await this.prisma.learningPath.count({ where: { parentId: id } })) > 0) {
      throw new ConflictException(PARENT_NOT_EMPTY);
    }

    try {
      await this.prisma.learningPath.delete({ where: { id } });
    } catch (error) {
      throw toWriteException(error, PATH_NAME_TAKEN);
    }
  }

  // ---------------------------------------------------------------------------
  // Administration : sous-parcours
  // ---------------------------------------------------------------------------

  /** Crée un sous-parcours **brouillon**, placé après ses frères. */
  async createSubPath(parentId: string, dto: CreateLearningPathDto, role: AdminRole) {
    await this.assertUnlocked(parentId, role);
    await this.assertCanHoldSubPaths(parentId);

    try {
      await this.prisma.learningPath.create({
        data: {
          name: dto.name,
          slug: slugify(dto.name),
          description: dto.description ?? '',
          parentId,
          position: await this.nextPosition(parentId),
        },
        select: { id: true },
      });
    } catch (error) {
      throw toWriteException(error, PATH_NAME_TAKEN);
    }

    return this.findAdminDetail(parentId);
  }

  /**
   * Rattache un parcours existant, sans parent ni sous-parcours, à un parent.
   *
   * Les droits portent sur les **deux** parcours : rattacher un parcours publié
   * le retire de la liste publique, rattacher à un parent publié change ce que
   * les visiteurs voient. L'écriture refiltre l'enfant (`parentId: null`, pas
   * d'enfant) : un rattachement concurrent ne passe pas entre la vérification
   * et l'écriture.
   */
  async attachSubPath(parentId: string, childId: string, role: AdminRole) {
    await this.assertUnlocked(parentId, role);
    await this.assertUnlocked(childId, role);
    await this.assertCanHoldSubPaths(parentId);

    if (parentId === childId) {
      throw new ConflictException(SELF_ATTACH);
    }

    const child = await this.prisma.learningPath.findUnique({
      where: { id: childId },
      select: { parentId: true, _count: { select: { children: true } } },
    });
    if (!child) {
      throw new NotFoundException();
    }
    if (child.parentId !== null) {
      throw new ConflictException(ALREADY_ATTACHED);
    }
    if (child._count.children > 0) {
      throw new ConflictException(ONE_LEVEL_ONLY);
    }

    const { count } = await this.prisma.learningPath.updateMany({
      where: { id: childId, parentId: null, children: { none: {} } },
      data: { parentId, position: await this.nextPosition(parentId) },
    });
    if (count === 0) {
      throw new ConflictException(COMPOSITION_CHANGED);
    }

    return this.findAdminDetail(parentId);
  }

  /**
   * Détache un sous-parcours : il redevient un parcours de premier niveau,
   * placé en fin de liste, modules et publication inchangés. Filtré par
   * `{ id, parentId }` : l'enfant d'un autre parent donne 404.
   */
  async detachSubPath(parentId: string, childId: string, role: AdminRole) {
    await this.assertUnlocked(parentId, role);
    await this.assertUnlocked(childId, role);

    const { count } = await this.prisma.learningPath.updateMany({
      where: { id: childId, parentId },
      data: { parentId: null, position: await this.nextPosition(null) },
    });

    if (count === 0) {
      throw new NotFoundException();
    }
  }

  /** Applique un ordre complet de sous-parcours (même règle que `reorderModules`). */
  async reorderSubPaths(parentId: string, pathIds: string[], role: AdminRole) {
    await this.assertUnlocked(parentId, role);

    await this.prisma.$transaction(async (tx) => {
      const parent = await tx.learningPath.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundException();
      }

      const current = await tx.learningPath.findMany({ where: { parentId }, select: { id: true } });
      if (
        !isSameIdSet(
          current.map((child) => child.id),
          pathIds,
        )
      ) {
        throw new ConflictException(COMPOSITION_CHANGED);
      }

      for (const [position, id] of pathIds.entries()) {
        const { count } = await tx.learningPath.updateMany({
          where: { id, parentId },
          data: { position },
        });
        if (count === 0) {
          throw new ConflictException(COMPOSITION_CHANGED);
        }
      }
    });

    return this.findAdminDetail(parentId);
  }

  /**
   * 404 si le parcours n'existe pas ; 409 s'il est lui-même un sous-parcours,
   * s'il a des modules, ou s'il a atteint `MAX_SUB_PATHS_PER_PATH`.
   */
  private async assertCanHoldSubPaths(pathId: string) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      select: { parentId: true, _count: { select: { modules: true, children: true } } },
    });

    if (!path) {
      throw new NotFoundException();
    }
    if (path.parentId !== null) {
      throw new ConflictException(ONE_LEVEL_ONLY);
    }
    if (path._count.modules > 0) {
      throw new ConflictException(MODULES_OR_SUB_PATHS);
    }
    if (path._count.children >= MAX_SUB_PATHS_PER_PATH) {
      throw new ConflictException(
        `Un parcours compte au plus ${MAX_SUB_PATHS_PER_PATH} sous-parcours`,
      );
    }
  }

  /** Position après le dernier frère (`parentId: null` = premier niveau). */
  private async nextPosition(parentId: string | null) {
    const { _max } = await this.prisma.learningPath.aggregate({
      where: { parentId },
      _max: { position: true },
    });
    return (_max.position ?? -1) + 1;
  }

  // ---------------------------------------------------------------------------
  // Administration : modules
  // ---------------------------------------------------------------------------

  /** Ajoute un module en fin de parcours, dans la limite de `MAX_MODULES_PER_PATH`. */
  async addModule(pathId: string, dto: CreatePathModuleDto, role: AdminRole) {
    await this.assertUnlocked(pathId, role);
    await this.assertPathExists(pathId);

    if ((await this.prisma.learningPath.count({ where: { parentId: pathId } })) > 0) {
      throw new ConflictException(MODULES_OR_SUB_PATHS);
    }

    const [count, { _max }] = await Promise.all([
      this.prisma.pathModule.count({ where: { pathId } }),
      this.prisma.pathModule.aggregate({ where: { pathId }, _max: { position: true } }),
    ]);

    if (count >= MAX_MODULES_PER_PATH) {
      throw new ConflictException(`Un parcours compte au plus ${MAX_MODULES_PER_PATH} modules`);
    }

    await this.prisma.pathModule.create({
      data: {
        pathId,
        title: dto.title,
        description: dto.description ?? '',
        position: (_max.position ?? -1) + 1,
      },
    });

    return this.findAdminDetail(pathId);
  }

  /**
   * `updateMany` filtré par `{ id, pathId }` plutôt qu'un `update` par id seul :
   * un module d'un **autre** parcours ne correspond à aucune ligne (404), il ne
   * peut pas être modifié en passant par la mauvaise URL.
   */
  async updateModule(pathId: string, moduleId: string, dto: UpdatePathModuleDto, role: AdminRole) {
    await this.assertUnlocked(pathId, role);

    const { count } = await this.prisma.pathModule.updateMany({
      where: { id: moduleId, pathId },
      data: { title: dto.title, description: dto.description },
    });

    if (count === 0) {
      throw new NotFoundException();
    }

    return this.findAdminDetail(pathId);
  }

  /** Supprime un module et ses étapes (cascade) ; les fiches restent. */
  async deleteModule(pathId: string, moduleId: string, role: AdminRole) {
    await this.assertUnlocked(pathId, role);

    const { count } = await this.prisma.pathModule.deleteMany({
      where: { id: moduleId, pathId },
    });

    if (count === 0) {
      throw new NotFoundException();
    }
  }

  /**
   * Applique un ordre complet de modules.
   *
   * Une **transaction interactive** regroupe la vérification et les écritures :
   * soit tout l'ordre est appliqué, soit rien (une erreur au milieu annule les
   * positions déjà écrites). Si la liste reçue n'est plus exactement celle des
   * modules actuels (un module ajouté ou supprimé dans un autre onglet), 409 :
   * mieux vaut demander un rechargement qu'écrire un ordre incomplet.
   */
  async reorderModules(pathId: string, moduleIds: string[], role: AdminRole) {
    await this.assertUnlocked(pathId, role);

    await this.prisma.$transaction(async (tx) => {
      const path = await tx.learningPath.findUnique({
        where: { id: pathId },
        select: { id: true },
      });
      if (!path) {
        throw new NotFoundException();
      }

      const current = await tx.pathModule.findMany({ where: { pathId }, select: { id: true } });
      if (
        !isSameIdSet(
          current.map((module) => module.id),
          moduleIds,
        )
      ) {
        throw new ConflictException(COMPOSITION_CHANGED);
      }

      for (const [position, id] of moduleIds.entries()) {
        const { count } = await tx.pathModule.updateMany({
          where: { id, pathId },
          data: { position },
        });
        // Supprimé entre la lecture et l'écriture : la transaction est annulée.
        if (count === 0) {
          throw new ConflictException(COMPOSITION_CHANGED);
        }
      }
    });

    return this.findAdminDetail(pathId);
  }

  // ---------------------------------------------------------------------------
  // Administration : étapes
  // ---------------------------------------------------------------------------

  /**
   * Ajoute une fiche en fin de module.
   *
   * `pathId` est recopié depuis le module : c'est lui qui porte la contrainte
   * « une fiche au plus une fois par parcours » (`@@unique([pathId, entryId])`).
   * Un doublon déclenche `P2002`, traduit en 409 — la base tranche, même si
   * deux ajouts arrivent en même temps. Une fiche brouillon est acceptée.
   */
  async addStep(pathId: string, moduleId: string, dto: CreatePathStepDto, role: AdminRole) {
    await this.assertUnlocked(pathId, role);
    await this.assertModuleInPath(pathId, moduleId);

    const entry = await this.prisma.entry.findUnique({
      where: { id: dto.entryId },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundException();
    }

    const [count, { _max }] = await Promise.all([
      this.prisma.pathStep.count({ where: { pathId } }),
      this.prisma.pathStep.aggregate({ where: { moduleId }, _max: { position: true } }),
    ]);

    if (count >= MAX_STEPS_PER_PATH) {
      throw new ConflictException(`Un parcours compte au plus ${MAX_STEPS_PER_PATH} étapes`);
    }

    try {
      await this.prisma.pathStep.create({
        data: {
          pathId,
          moduleId,
          entryId: dto.entryId,
          optional: dto.optional ?? false,
          position: (_max.position ?? -1) + 1,
        },
      });
    } catch (error) {
      throw toWriteException(error, STEP_DUPLICATE);
    }

    return this.findAdminDetail(pathId);
  }

  /** Marque une étape facultative ou obligatoire (même filtrage par parent que les modules). */
  async updateStep(pathId: string, stepId: string, dto: UpdatePathStepDto, role: AdminRole) {
    await this.assertUnlocked(pathId, role);

    const { count } = await this.prisma.pathStep.updateMany({
      where: { id: stepId, pathId },
      data: { optional: dto.optional },
    });

    if (count === 0) {
      throw new NotFoundException();
    }

    return this.findAdminDetail(pathId);
  }

  /** Retire une étape ; la fiche reste intacte dans le catalogue. */
  async deleteStep(pathId: string, stepId: string, role: AdminRole) {
    await this.assertUnlocked(pathId, role);

    const { count } = await this.prisma.pathStep.deleteMany({ where: { id: stepId, pathId } });

    if (count === 0) {
      throw new NotFoundException();
    }
  }

  /** Applique un ordre complet d'étapes dans un module (voir `reorderModules`). */
  async reorderSteps(pathId: string, moduleId: string, stepIds: string[], role: AdminRole) {
    await this.assertUnlocked(pathId, role);

    await this.prisma.$transaction(async (tx) => {
      const module = await tx.pathModule.findFirst({
        where: { id: moduleId, pathId },
        select: { id: true },
      });
      if (!module) {
        throw new NotFoundException();
      }

      const current = await tx.pathStep.findMany({ where: { moduleId }, select: { id: true } });
      if (
        !isSameIdSet(
          current.map((step) => step.id),
          stepIds,
        )
      ) {
        throw new ConflictException(COMPOSITION_CHANGED);
      }

      for (const [position, id] of stepIds.entries()) {
        const { count } = await tx.pathStep.updateMany({
          where: { id, moduleId },
          data: { position },
        });
        if (count === 0) {
          throw new ConflictException(COMPOSITION_CHANGED);
        }
      }
    });

    return this.findAdminDetail(pathId);
  }

  /**
   * 403 si le parcours est publié et que le rôle n'y a pas droit. Appelé en
   * tête de **chaque** écriture, sous-ressources comprises : ajouter une étape
   * à un parcours en ligne, c'est modifier ce que les visiteurs voient.
   *
   * Un parcours introuvable n'est pas traité ici : la suite de la méthode
   * répond 404, comme avant. La lecture est épargnée au `SUPER_ADMIN`.
   */
  private async assertUnlocked(pathId: string, role: AdminRole) {
    if (canManagePublished(role)) {
      return;
    }

    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      select: { published: true },
    });
    assertUnlocked(role, path?.published ?? false);
  }

  private async assertPathExists(pathId: string) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      select: { id: true },
    });
    if (!path) {
      throw new NotFoundException();
    }
  }

  /** 404 si le module n'existe pas **ou** appartient à un autre parcours. */
  private async assertModuleInPath(pathId: string, moduleId: string) {
    const module = await this.prisma.pathModule.findFirst({
      where: { id: moduleId, pathId },
      select: { id: true },
    });
    if (!module) {
      throw new NotFoundException();
    }
  }
}
