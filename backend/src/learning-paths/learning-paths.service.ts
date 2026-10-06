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

const PATH_NAME_TAKEN = 'Un parcours avec un nom trop proche existe déjà';
const STEP_DUPLICATE = 'Cette fiche est déjà dans ce parcours';
const COMPOSITION_CHANGED =
  'La composition du parcours a changé depuis le dernier chargement : recharger avant de réordonner';

/**
 * Filtre « fiche visible » d'une étape. Une étape dont la fiche est un
 * brouillon n'est ni affichée ni comptée côté public : elle réapparaît d'elle
 * même si la fiche est republiée, sans toucher au parcours.
 */
export const VISIBLE_STEP_WHERE = {
  entry: { published: true },
} satisfies Prisma.PathStepWhereInput;

/**
 * Parcours publiés, dans l'ordre de la liste publique. Partagé avec la
 * progression : sa liste doit paginer les **mêmes** parcours, dans le même
 * ordre, pour que le SPA fusionne les deux pages.
 */
export const PUBLISHED_PATHS_WHERE = { published: true } satisfies Prisma.LearningPathWhereInput;
export const PUBLISHED_PATHS_ORDER = [
  { position: 'asc' },
  { name: 'asc' },
] satisfies Prisma.LearningPathOrderByWithRelationInput[];

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
   */
  async findPublished(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = PUBLISHED_PATHS_WHERE;

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
        },
      }),
      this.prisma.learningPath.count({ where }),
    ]);

    const items = rows.map(({ _count, ...path }) => ({ ...path, stepCount: _count.steps }));
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
   */
  async findPublishedBySlug(slug: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: { slug, published: true },
      select: PUBLIC_PATH_SELECT,
    });

    if (!path) {
      throw new NotFoundException();
    }

    return { ...path, modules: path.modules.filter((module) => module.steps.length > 0) };
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
          _count: { select: { modules: true, steps: true } },
        },
      }),
      this.prisma.learningPath.count(),
    ]);

    const items = rows.map(({ _count, ...path }) => ({
      ...path,
      moduleCount: _count.modules,
      stepCount: _count.steps,
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

    return path;
  }

  /**
   * Crée un parcours **brouillon**, placé en fin de liste. Le slug est calculé
   * depuis le nom ; un slug déjà pris donne 409 plutôt qu'une erreur de base.
   */
  async create(dto: CreateLearningPathDto) {
    const { _max } = await this.prisma.learningPath.aggregate({ _max: { position: true } });

    try {
      const created = await this.prisma.learningPath.create({
        data: {
          name: dto.name,
          slug: slugify(dto.name),
          description: dto.description ?? '',
          position: (_max.position ?? -1) + 1,
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

  /** Supprime le parcours ; modules et étapes partent en cascade, les fiches restent. */
  async delete(id: string, role: AdminRole) {
    await this.assertUnlocked(id, role);

    try {
      await this.prisma.learningPath.delete({ where: { id } });
    } catch (error) {
      throw toWriteException(error, PATH_NAME_TAKEN);
    }
  }

  // ---------------------------------------------------------------------------
  // Administration : modules
  // ---------------------------------------------------------------------------

  /** Ajoute un module en fin de parcours, dans la limite de `MAX_MODULES_PER_PATH`. */
  async addModule(pathId: string, dto: CreatePathModuleDto, role: AdminRole) {
    await this.assertUnlocked(pathId, role);
    await this.assertPathExists(pathId);

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
