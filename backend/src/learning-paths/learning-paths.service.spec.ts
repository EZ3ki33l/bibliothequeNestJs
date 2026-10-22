import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  LearningPathsService,
  MAX_MODULES_PER_PATH,
  MAX_STEPS_PER_PATH,
  MAX_SUB_PATHS_PER_PATH,
} from './learning-paths.service';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';

/** Vraie erreur Prisma (code `P2002`, `P2025`…), sans base de données. */
function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

const pathId = 'path-1';
const moduleId = 'module-1';
const detail = {
  id: pathId,
  name: 'Web',
  slug: 'web',
  description: '',
  published: false,
  parent: null,
  children: [],
  modules: [],
};
/** Ce que `findAdminDetail` renvoie pour `detail` : `children` devient `subPaths`. */
const adminDetail = {
  id: pathId,
  name: 'Web',
  slug: 'web',
  description: '',
  published: false,
  parent: null,
  modules: [],
  subPaths: [],
};

/** Ligne publique minimale : ni parent, ni sous-parcours. */
const publicRow = (modules: unknown[] = []) => ({
  id: 'p1',
  name: 'Web',
  slug: 'web',
  description: '',
  modules,
  parent: null,
  children: [],
});

function entryCard(id: string) {
  return {
    id,
    title: id,
    slug: id,
    summary: '',
    kind: 'FUNCTION',
    difficulty: 'BEGINNER',
    tags: [],
    category: null,
  };
}

describe('LearningPathsService', () => {
  let service: LearningPathsService;
  const prisma = {
    learningPath: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    pathModule: {
      count: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    pathStep: {
      count: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    entry: {
      findUnique: jest.fn(),
    },
    // La transaction interactive reçoit le même client simulé : les appels
    // faits « dans » la transaction restent observables.
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [LearningPathsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(LearningPathsService);
  });

  describe('findPublished', () => {
    it('lists published top-level paths only, in admin order, paginated', async () => {
      prisma.learningPath.findMany.mockResolvedValue([]);
      prisma.learningPath.count.mockResolvedValue(0);

      await service.findPublished(2, 10);

      const call = prisma.learningPath.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ published: true, parentId: null });
      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
      expect(call.orderBy).toEqual([{ position: 'asc' }, { name: 'asc' }]);
      expect(prisma.learningPath.count).toHaveBeenCalledWith({
        where: { published: true, parentId: null },
      });
    });

    it('adds the visible steps of published sub-paths to a parent', async () => {
      prisma.learningPath.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'TSSR',
          slug: 'tssr',
          description: '',
          _count: { steps: 0 },
          children: [{ _count: { steps: 4 } }, { _count: { steps: 3 } }],
        },
      ]);
      prisma.learningPath.count.mockResolvedValue(1);

      const result = await service.findPublished(1, 50);

      const call = prisma.learningPath.findMany.mock.calls[0][0];
      expect(call.select.children.where).toEqual({ published: true });
      expect(result.items[0]).toMatchObject({ stepCount: 7, subPathCount: 2 });
    });

    it('counts only steps whose entry is published', async () => {
      prisma.learningPath.findMany.mockResolvedValue([]);
      prisma.learningPath.count.mockResolvedValue(0);

      await service.findPublished(1, 50);

      const call = prisma.learningPath.findMany.mock.calls[0][0];
      expect(call.select._count).toEqual({
        select: { steps: { where: { entry: { published: true } } } },
      });
    });

    it('maps _count to stepCount and returns a page envelope', async () => {
      prisma.learningPath.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Web',
          slug: 'web',
          description: '',
          _count: { steps: 7 },
          children: [],
        },
      ]);
      prisma.learningPath.count.mockResolvedValue(1);

      const result = await service.findPublished(1, 50);

      expect(result).toEqual({
        items: [
          { id: 'p1', name: 'Web', slug: 'web', description: '', stepCount: 7, subPathCount: 0 },
        ],
        total: 1,
        page: 1,
        limit: 50,
      });
    });
  });

  describe('findPublishedBySlug', () => {
    it('looks up a visible path by slug: published, and its parent too if any', async () => {
      prisma.learningPath.findFirst.mockResolvedValue(publicRow());

      const result = await service.findPublishedBySlug('web');

      const call = prisma.learningPath.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({
        slug: 'web',
        published: true,
        OR: [{ parentId: null }, { parent: { published: true } }],
      });
      expect(result).toMatchObject({ parent: null, nextSubPath: null, subPaths: [] });
    });

    it('names the parent and the next visible sibling of a sub-path', async () => {
      prisma.learningPath.findFirst.mockResolvedValue({
        ...publicRow(),
        id: 'reseaux',
        parent: {
          name: 'TSSR',
          slug: 'tssr',
          children: [
            { id: 'reseaux', name: 'Réseaux', slug: 'reseaux' },
            { id: 'linux', name: 'Linux', slug: 'linux' },
          ],
        },
      });

      const result = await service.findPublishedBySlug('reseaux');

      const select = prisma.learningPath.findFirst.mock.calls[0][0].select;
      expect(select.parent.select.children.where).toEqual({ published: true });
      expect(result.parent).toEqual({ name: 'TSSR', slug: 'tssr' });
      expect(result.nextSubPath).toEqual({ name: 'Linux', slug: 'linux' });
      expect(result).not.toHaveProperty('children');
    });

    it('gives no next sub-path to the last sibling', async () => {
      prisma.learningPath.findFirst.mockResolvedValue({
        ...publicRow(),
        id: 'linux',
        parent: {
          name: 'TSSR',
          slug: 'tssr',
          children: [
            { id: 'reseaux', name: 'Réseaux', slug: 'reseaux' },
            { id: 'linux', name: 'Linux', slug: 'linux' },
          ],
        },
      });

      expect((await service.findPublishedBySlug('linux')).nextSubPath).toBeNull();
    });

    it('lists the published sub-paths of a parent with their visible step count', async () => {
      prisma.learningPath.findFirst.mockResolvedValue({
        ...publicRow(),
        children: [
          { id: 'c1', name: 'Réseaux', slug: 'reseaux', description: '', _count: { steps: 5 } },
        ],
      });

      const result = await service.findPublishedBySlug('web');

      const select = prisma.learningPath.findFirst.mock.calls[0][0].select;
      expect(select.children.where).toEqual({ published: true });
      expect(select.children.select._count).toEqual({
        select: { steps: { where: { entry: { published: true } } } },
      });
      expect(result.subPaths).toEqual([
        { id: 'c1', name: 'Réseaux', slug: 'reseaux', description: '', stepCount: 5 },
      ]);
    });

    it('throws 404 when the path is unknown or a draft', async () => {
      prisma.learningPath.findFirst.mockResolvedValue(null);

      await expect(service.findPublishedBySlug('brouillon')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('orders modules and steps, hides draft entries, never selects the body', async () => {
      prisma.learningPath.findFirst.mockResolvedValue(publicRow());

      await service.findPublishedBySlug('web');

      const modules = prisma.learningPath.findFirst.mock.calls[0][0].select.modules;
      expect(modules.orderBy).toEqual({ position: 'asc' });
      expect(modules.select.steps.orderBy).toEqual({ position: 'asc' });
      expect(modules.select.steps.where).toEqual({ entry: { published: true } });
      expect(modules.select.steps.select.entry).toEqual({ select: ENTRY_CARD_SELECT });
      expect(ENTRY_CARD_SELECT).not.toHaveProperty('bodyMdx');
    });

    it('drops modules without any visible step', async () => {
      const visible = {
        id: 'm1',
        title: 'Bases',
        description: '',
        steps: [{ id: 's1', optional: false, entry: entryCard('html') }],
      };
      const empty = { id: 'm2', title: 'Brouillons', description: '', steps: [] };
      prisma.learningPath.findFirst.mockResolvedValue(publicRow([visible, empty]));

      const result = await service.findPublishedBySlug('web');

      expect(result.modules).toEqual([visible]);
    });
  });

  describe('findAllAdmin', () => {
    it('includes drafts and maps counts', async () => {
      prisma.learningPath.findMany.mockResolvedValue([
        {
          id: pathId,
          name: 'Web',
          slug: 'web',
          published: false,
          position: 0,
          parent: null,
          _count: { modules: 2, steps: 5, children: 0 },
        },
      ]);
      prisma.learningPath.count.mockResolvedValue(1);

      const result = await service.findAllAdmin(1, 50);

      expect(prisma.learningPath.findMany.mock.calls[0][0]).not.toHaveProperty('where');
      expect(result.items).toEqual([
        {
          id: pathId,
          name: 'Web',
          slug: 'web',
          published: false,
          position: 0,
          parent: null,
          moduleCount: 2,
          stepCount: 5,
          subPathCount: 0,
        },
      ]);
      expect(result.total).toBe(1);
    });
  });

  describe('findAdminDetail', () => {
    it('returns every step, drafts included, with entry.published', async () => {
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await expect(service.findAdminDetail(pathId)).resolves.toEqual(adminDetail);

      const select = prisma.learningPath.findUnique.mock.calls[0][0].select;
      expect(select.modules.select.steps).not.toHaveProperty('where');
      expect(select.modules.select.steps.select.entry.select.published).toBe(true);
      expect(select.modules.select.steps.select.entry.select).not.toHaveProperty('bodyMdx');
    });

    it('throws 404 when unknown', async () => {
      prisma.learningPath.findUnique.mockResolvedValue(null);

      await expect(service.findAdminDetail('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('computes slug and position server-side and starts as a draft', async () => {
      prisma.learningPath.aggregate.mockResolvedValue({ _max: { position: 3 } });
      prisma.learningPath.create.mockResolvedValue({ id: pathId });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await expect(service.create({ name: 'Développement Web' })).resolves.toEqual(adminDetail);

      expect(prisma.learningPath.create).toHaveBeenCalledWith({
        data: {
          name: 'Développement Web',
          slug: 'developpement-web',
          description: '',
          position: 4,
        },
        select: { id: true },
      });
    });

    it('starts at position 0 when there is no path yet', async () => {
      prisma.learningPath.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.learningPath.create.mockResolvedValue({ id: pathId });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.create({ name: 'Web', description: 'Bases' });

      expect(prisma.learningPath.create.mock.calls[0][0].data).toMatchObject({
        position: 0,
        description: 'Bases',
      });
    });

    it('maps a taken slug to 409', async () => {
      prisma.learningPath.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.learningPath.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.create({ name: 'Web' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('recomputes the slug on rename and can publish', async () => {
      prisma.learningPath.update.mockResolvedValue({ id: pathId });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.update(pathId, { name: 'Python', published: true }, 'SUPER_ADMIN');

      expect(prisma.learningPath.update).toHaveBeenCalledWith({
        where: { id: pathId },
        data: { name: 'Python', slug: 'python', published: true },
        select: { id: true },
      });
    });

    it('only writes the provided fields', async () => {
      prisma.learningPath.update.mockResolvedValue({ id: pathId });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.update(pathId, { description: 'Nouvelle description' }, 'SUPER_ADMIN');

      expect(prisma.learningPath.update.mock.calls[0][0].data).toEqual({
        description: 'Nouvelle description',
      });
    });

    it('maps an unknown id to 404', async () => {
      prisma.learningPath.update.mockRejectedValue(knownRequestError('P2025'));

      await expect(
        service.update('nope', { published: true }, 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes the path only (entries untouched)', async () => {
      prisma.learningPath.delete.mockResolvedValue({ id: pathId });

      await service.delete(pathId, 'SUPER_ADMIN');

      expect(prisma.learningPath.delete).toHaveBeenCalledWith({ where: { id: pathId } });
    });

    it('maps an unknown id to 404', async () => {
      prisma.learningPath.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.delete('nope', 'SUPER_ADMIN')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addModule', () => {
    beforeEach(() => {
      prisma.learningPath.findUnique.mockResolvedValueOnce({ id: pathId });
    });

    it('appends the module at the end of the path', async () => {
      prisma.pathModule.count.mockResolvedValue(2);
      prisma.pathModule.aggregate.mockResolvedValue({ _max: { position: 1 } });
      prisma.learningPath.findUnique.mockResolvedValueOnce(detail);

      await expect(service.addModule(pathId, { title: 'Bases' }, 'SUPER_ADMIN')).resolves.toEqual(
        adminDetail,
      );

      expect(prisma.pathModule.create).toHaveBeenCalledWith({
        data: { pathId, title: 'Bases', description: '', position: 2 },
      });
    });

    it('refuses beyond the module cap with 409', async () => {
      prisma.pathModule.count.mockResolvedValue(MAX_MODULES_PER_PATH);
      prisma.pathModule.aggregate.mockResolvedValue({ _max: { position: 29 } });

      await expect(
        service.addModule(pathId, { title: 'Trop' }, 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.pathModule.create).not.toHaveBeenCalled();
    });
  });

  it('addModule throws 404 for an unknown path', async () => {
    prisma.learningPath.findUnique.mockResolvedValue(null);

    await expect(
      service.addModule('nope', { title: 'Bases' }, 'SUPER_ADMIN'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('updateModule / deleteModule', () => {
    it('scopes the update to the parent path', async () => {
      prisma.pathModule.updateMany.mockResolvedValue({ count: 1 });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.updateModule(pathId, moduleId, { title: 'Renommé' }, 'SUPER_ADMIN');

      expect(prisma.pathModule.updateMany).toHaveBeenCalledWith({
        where: { id: moduleId, pathId },
        data: { title: 'Renommé', description: undefined },
      });
    });

    it('404 when the module belongs to another path', async () => {
      prisma.pathModule.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateModule(pathId, 'foreign-module', { title: 'X' }, 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes scoped to the parent path', async () => {
      prisma.pathModule.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteModule(pathId, moduleId, 'SUPER_ADMIN');

      expect(prisma.pathModule.deleteMany).toHaveBeenCalledWith({
        where: { id: moduleId, pathId },
      });
    });

    it('delete: 404 when nothing matched', async () => {
      prisma.pathModule.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteModule(pathId, 'nope', 'SUPER_ADMIN')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reorderModules', () => {
    beforeEach(() => {
      prisma.learningPath.findUnique.mockResolvedValueOnce({ id: pathId });
      prisma.pathModule.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    });

    it('writes position = index inside a transaction', async () => {
      prisma.pathModule.updateMany.mockResolvedValue({ count: 1 });
      prisma.learningPath.findUnique.mockResolvedValueOnce(detail);

      await expect(service.reorderModules(pathId, ['m2', 'm1'], 'SUPER_ADMIN')).resolves.toEqual(
        adminDetail,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.pathModule.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'm2', pathId },
        data: { position: 0 },
      });
      expect(prisma.pathModule.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'm1', pathId },
        data: { position: 1 },
      });
    });

    it('409 when a module is missing from the list', async () => {
      await expect(service.reorderModules(pathId, ['m1'], 'SUPER_ADMIN')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.pathModule.updateMany).not.toHaveBeenCalled();
    });

    it('409 when the list contains a foreign module', async () => {
      await expect(
        service.reorderModules(pathId, ['m1', 'other'], 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('409 when a module disappears between read and write', async () => {
      prisma.pathModule.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(
        service.reorderModules(pathId, ['m1', 'm2'], 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('reorderModules throws 404 for an unknown path', async () => {
    prisma.learningPath.findUnique.mockResolvedValue(null);

    await expect(service.reorderModules('nope', ['m1'], 'SUPER_ADMIN')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('addStep', () => {
    const entryId = 'entry-1';

    it('copies pathId from the module and appends at the end of the module', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue({ id: entryId });
      prisma.pathStep.count.mockResolvedValue(3);
      prisma.pathStep.aggregate.mockResolvedValue({ _max: { position: 2 } });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await expect(service.addStep(pathId, moduleId, { entryId }, 'SUPER_ADMIN')).resolves.toEqual(
        adminDetail,
      );

      expect(prisma.pathModule.findFirst).toHaveBeenCalledWith({
        where: { id: moduleId, pathId },
        select: { id: true },
      });
      expect(prisma.pathStep.count).toHaveBeenCalledWith({ where: { pathId } });
      expect(prisma.pathStep.aggregate).toHaveBeenCalledWith({
        where: { moduleId },
        _max: { position: true },
      });
      expect(prisma.pathStep.create).toHaveBeenCalledWith({
        data: { pathId, moduleId, entryId, optional: false, position: 3 },
      });
    });

    it('accepts the optional flag', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue({ id: entryId });
      prisma.pathStep.count.mockResolvedValue(0);
      prisma.pathStep.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.addStep(pathId, moduleId, { entryId, optional: true }, 'SUPER_ADMIN');

      expect(prisma.pathStep.create.mock.calls[0][0].data).toMatchObject({
        optional: true,
        position: 0,
      });
    });

    it('404 when the module belongs to another path', async () => {
      prisma.pathModule.findFirst.mockResolvedValue(null);

      await expect(
        service.addStep(pathId, 'foreign', { entryId }, 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.pathStep.create).not.toHaveBeenCalled();
    });

    it('404 when the entry is unknown', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue(null);

      await expect(
        service.addStep(pathId, moduleId, { entryId }, 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 beyond the step cap', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue({ id: entryId });
      prisma.pathStep.count.mockResolvedValue(MAX_STEPS_PER_PATH);
      prisma.pathStep.aggregate.mockResolvedValue({ _max: { position: 10 } });

      await expect(
        service.addStep(pathId, moduleId, { entryId }, 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.pathStep.create).not.toHaveBeenCalled();
    });

    it('409 when the entry is already in this path (unique constraint)', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue({ id: entryId });
      prisma.pathStep.count.mockResolvedValue(1);
      prisma.pathStep.aggregate.mockResolvedValue({ _max: { position: 0 } });
      prisma.pathStep.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.addStep(pathId, moduleId, { entryId }, 'SUPER_ADMIN')).rejects.toThrow(
        'Cette fiche est déjà dans ce parcours',
      );
    });
  });

  describe('updateStep / deleteStep', () => {
    it('scopes the update to the parent path', async () => {
      prisma.pathStep.updateMany.mockResolvedValue({ count: 1 });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.updateStep(pathId, 'step-1', { optional: true }, 'SUPER_ADMIN');

      expect(prisma.pathStep.updateMany).toHaveBeenCalledWith({
        where: { id: 'step-1', pathId },
        data: { optional: true },
      });
    });

    it('update: 404 when nothing matched', async () => {
      prisma.pathStep.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStep(pathId, 'nope', { optional: true }, 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes scoped to the parent path, never the entry', async () => {
      prisma.pathStep.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteStep(pathId, 'step-1', 'SUPER_ADMIN');

      expect(prisma.pathStep.deleteMany).toHaveBeenCalledWith({ where: { id: 'step-1', pathId } });
    });

    it('delete: 404 when nothing matched', async () => {
      prisma.pathStep.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteStep(pathId, 'nope', 'SUPER_ADMIN')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reorderSteps', () => {
    it('checks the module belongs to the path, then writes positions', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.pathStep.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      prisma.pathStep.updateMany.mockResolvedValue({ count: 1 });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await expect(
        service.reorderSteps(pathId, moduleId, ['s2', 's1'], 'SUPER_ADMIN'),
      ).resolves.toEqual(adminDetail);

      expect(prisma.pathModule.findFirst).toHaveBeenCalledWith({
        where: { id: moduleId, pathId },
        select: { id: true },
      });
      expect(prisma.pathStep.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 's2', moduleId },
        data: { position: 0 },
      });
    });

    it('404 when the module belongs to another path', async () => {
      prisma.pathModule.findFirst.mockResolvedValue(null);

      await expect(
        service.reorderSteps(pathId, 'foreign', ['s1'], 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 when the list is not the exact current set', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.pathStep.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

      await expect(
        service.reorderSteps(pathId, moduleId, ['s1', 's2', 's3'], 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('409 when a step disappears between read and write', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.pathStep.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.pathStep.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.reorderSteps(pathId, moduleId, ['s1'], 'SUPER_ADMIN'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('ADMIN role (draft paths only)', () => {
    it('refuses to publish a path', async () => {
      await expect(service.update(pathId, { published: true }, 'ADMIN')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.learningPath.update).not.toHaveBeenCalled();
    });

    describe('on a published path', () => {
      beforeEach(() => {
        prisma.learningPath.findUnique.mockResolvedValue({ published: true });
      });

      it.each([
        ['update', () => service.update(pathId, { name: 'Python' }, 'ADMIN')],
        ['unpublish', () => service.update(pathId, { published: false }, 'ADMIN')],
        ['delete', () => service.delete(pathId, 'ADMIN')],
        ['addModule', () => service.addModule(pathId, { title: 'Bases' }, 'ADMIN')],
        ['updateModule', () => service.updateModule(pathId, moduleId, { title: 'X' }, 'ADMIN')],
        ['deleteModule', () => service.deleteModule(pathId, moduleId, 'ADMIN')],
        ['reorderModules', () => service.reorderModules(pathId, ['m1'], 'ADMIN')],
        ['addStep', () => service.addStep(pathId, moduleId, { entryId: 'e1' }, 'ADMIN')],
        ['updateStep', () => service.updateStep(pathId, 's1', { optional: true }, 'ADMIN')],
        ['deleteStep', () => service.deleteStep(pathId, 's1', 'ADMIN')],
        ['reorderSteps', () => service.reorderSteps(pathId, moduleId, ['s1'], 'ADMIN')],
      ])('refuses %s with 403 and writes nothing', async (_name, write) => {
        await expect(write()).rejects.toBeInstanceOf(ForbiddenException);

        expect(prisma.learningPath.findUnique).toHaveBeenCalledWith({
          where: { id: pathId },
          select: { published: true },
        });
        expect(prisma.learningPath.update).not.toHaveBeenCalled();
        expect(prisma.learningPath.delete).not.toHaveBeenCalled();
        expect(prisma.pathModule.create).not.toHaveBeenCalled();
        expect(prisma.pathModule.updateMany).not.toHaveBeenCalled();
        expect(prisma.pathModule.deleteMany).not.toHaveBeenCalled();
        expect(prisma.pathStep.create).not.toHaveBeenCalled();
        expect(prisma.pathStep.updateMany).not.toHaveBeenCalled();
        expect(prisma.pathStep.deleteMany).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
    });

    it('composes a draft path', async () => {
      prisma.learningPath.findUnique.mockResolvedValue({ published: false });
      prisma.pathModule.deleteMany.mockResolvedValue({ count: 1 });
      prisma.learningPath.delete.mockResolvedValue({ id: pathId });

      await service.deleteModule(pathId, moduleId, 'ADMIN');
      await service.delete(pathId, 'ADMIN');

      expect(prisma.pathModule.deleteMany).toHaveBeenCalledWith({
        where: { id: moduleId, pathId },
      });
      expect(prisma.learningPath.delete).toHaveBeenCalledWith({ where: { id: pathId } });
    });

    it('answers 404, not 403, for an unknown path', async () => {
      prisma.learningPath.findUnique.mockResolvedValue(null);

      await expect(service.addModule('nope', { title: 'Bases' }, 'ADMIN')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
  describe('sous-parcours', () => {
    const parentId = 'parent-1';
    const childId = 'child-1';
    /** Parent prêt à recevoir : premier niveau, sans module, sous le plafond. */
    const holder = { parentId: null, _count: { modules: 0, children: 1 } };

    it('refuses to add a module to a parent', async () => {
      prisma.learningPath.findUnique.mockResolvedValueOnce({ id: parentId });
      prisma.learningPath.count.mockResolvedValue(2);

      await expect(service.addModule(parentId, { title: 'Bases' }, 'SUPER_ADMIN')).rejects.toThrow(
        'soit des modules, soit des sous-parcours',
      );
      expect(prisma.pathModule.create).not.toHaveBeenCalled();
    });

    it('refuses to delete a parent that still has sub-paths', async () => {
      prisma.learningPath.count.mockResolvedValue(1);

      await expect(service.delete(parentId, 'SUPER_ADMIN')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.learningPath.count).toHaveBeenCalledWith({ where: { parentId } });
      expect(prisma.learningPath.delete).not.toHaveBeenCalled();
    });

    describe('createSubPath', () => {
      it('creates a draft child after its siblings', async () => {
        prisma.learningPath.findUnique.mockResolvedValueOnce(holder).mockResolvedValueOnce(detail);
        prisma.learningPath.aggregate.mockResolvedValue({ _max: { position: 0 } });
        prisma.learningPath.create.mockResolvedValue({ id: childId });

        await expect(
          service.createSubPath(parentId, { name: 'Réseaux' }, 'SUPER_ADMIN'),
        ).resolves.toEqual(adminDetail);

        expect(prisma.learningPath.aggregate).toHaveBeenCalledWith({
          where: { parentId },
          _max: { position: true },
        });
        expect(prisma.learningPath.create).toHaveBeenCalledWith({
          data: { name: 'Réseaux', slug: 'reseaux', description: '', parentId, position: 1 },
          select: { id: true },
        });
      });

      it.each([
        ['a sub-path', { parentId: 'x', _count: { modules: 0, children: 0 } }, 'Un seul niveau'],
        [
          'a path with modules',
          { parentId: null, _count: { modules: 1, children: 0 } },
          'pas les deux',
        ],
        [
          'a full parent',
          { parentId: null, _count: { modules: 0, children: MAX_SUB_PATHS_PER_PATH } },
          'au plus 30',
        ],
      ])('refuses (409) under %s', async (_label, parent, message) => {
        prisma.learningPath.findUnique.mockResolvedValueOnce(parent);

        await expect(
          service.createSubPath(parentId, { name: 'Réseaux' }, 'SUPER_ADMIN'),
        ).rejects.toThrow(message);
        expect(prisma.learningPath.create).not.toHaveBeenCalled();
      });

      it('answers 404 for an unknown parent', async () => {
        prisma.learningPath.findUnique.mockResolvedValueOnce(null);

        await expect(
          service.createSubPath('nope', { name: 'Réseaux' }, 'SUPER_ADMIN'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('attachSubPath', () => {
      it('attaches a top-level path without children, re-checking it in the write', async () => {
        prisma.learningPath.findUnique
          .mockResolvedValueOnce(holder)
          .mockResolvedValueOnce({ parentId: null, _count: { children: 0 } })
          .mockResolvedValueOnce(detail);
        prisma.learningPath.aggregate.mockResolvedValue({ _max: { position: 2 } });
        prisma.learningPath.updateMany.mockResolvedValue({ count: 1 });

        await expect(service.attachSubPath(parentId, childId, 'SUPER_ADMIN')).resolves.toEqual(
          adminDetail,
        );

        expect(prisma.learningPath.updateMany).toHaveBeenCalledWith({
          where: { id: childId, parentId: null, children: { none: {} } },
          data: { parentId, position: 3 },
        });
      });

      it('refuses to attach a path to itself', async () => {
        prisma.learningPath.findUnique.mockResolvedValueOnce(holder);

        await expect(service.attachSubPath(parentId, parentId, 'SUPER_ADMIN')).rejects.toThrow(
          'son propre sous-parcours',
        );
      });

      it.each([
        ['already attached', { parentId: 'other', _count: { children: 0 } }, 'déjà rattaché'],
        ['a parent itself', { parentId: null, _count: { children: 2 } }, 'Un seul niveau'],
      ])('refuses (409) a child that is %s', async (_label, child, message) => {
        prisma.learningPath.findUnique.mockResolvedValueOnce(holder).mockResolvedValueOnce(child);

        await expect(service.attachSubPath(parentId, childId, 'SUPER_ADMIN')).rejects.toThrow(
          message,
        );
        expect(prisma.learningPath.updateMany).not.toHaveBeenCalled();
      });

      it('answers 409 when the child changed between the check and the write', async () => {
        prisma.learningPath.findUnique
          .mockResolvedValueOnce(holder)
          .mockResolvedValueOnce({ parentId: null, _count: { children: 0 } });
        prisma.learningPath.aggregate.mockResolvedValue({ _max: { position: null } });
        prisma.learningPath.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.attachSubPath(parentId, childId, 'SUPER_ADMIN'),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('answers 404 for an unknown child', async () => {
        prisma.learningPath.findUnique.mockResolvedValueOnce(holder).mockResolvedValueOnce(null);

        await expect(
          service.attachSubPath(parentId, childId, 'SUPER_ADMIN'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('refuses an ADMIN when the child is published', async () => {
        prisma.learningPath.findUnique
          .mockResolvedValueOnce({ published: false })
          .mockResolvedValueOnce({ published: true });

        await expect(service.attachSubPath(parentId, childId, 'ADMIN')).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(prisma.learningPath.updateMany).not.toHaveBeenCalled();
      });
    });

    describe('detachSubPath', () => {
      it('puts the child back at the end of the top-level list, scoped to its parent', async () => {
        prisma.learningPath.aggregate.mockResolvedValue({ _max: { position: 4 } });
        prisma.learningPath.updateMany.mockResolvedValue({ count: 1 });

        await service.detachSubPath(parentId, childId, 'SUPER_ADMIN');

        expect(prisma.learningPath.aggregate).toHaveBeenCalledWith({
          where: { parentId: null },
          _max: { position: true },
        });
        expect(prisma.learningPath.updateMany).toHaveBeenCalledWith({
          where: { id: childId, parentId },
          data: { parentId: null, position: 5 },
        });
      });

      it("answers 404 for a path that isn't a child of this parent", async () => {
        prisma.learningPath.aggregate.mockResolvedValue({ _max: { position: null } });
        prisma.learningPath.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.detachSubPath(parentId, childId, 'SUPER_ADMIN'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('refuses an ADMIN when the parent is published', async () => {
        prisma.learningPath.findUnique.mockResolvedValueOnce({ published: true });

        await expect(service.detachSubPath(parentId, childId, 'ADMIN')).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(prisma.learningPath.updateMany).not.toHaveBeenCalled();
      });
    });

    describe('reorderSubPaths', () => {
      it('writes position = index inside a transaction', async () => {
        prisma.learningPath.findUnique
          .mockResolvedValueOnce({ id: parentId })
          .mockResolvedValueOnce(detail);
        prisma.learningPath.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
        prisma.learningPath.updateMany.mockResolvedValue({ count: 1 });

        await service.reorderSubPaths(parentId, ['b', 'a'], 'SUPER_ADMIN');

        expect(prisma.learningPath.findMany).toHaveBeenCalledWith({
          where: { parentId },
          select: { id: true },
        });
        expect(prisma.learningPath.updateMany).toHaveBeenNthCalledWith(1, {
          where: { id: 'b', parentId },
          data: { position: 0 },
        });
        expect(prisma.learningPath.updateMany).toHaveBeenNthCalledWith(2, {
          where: { id: 'a', parentId },
          data: { position: 1 },
        });
      });

      it('answers 409 when the list is not exactly the current sub-paths', async () => {
        prisma.learningPath.findUnique.mockResolvedValueOnce({ id: parentId });
        prisma.learningPath.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

        await expect(
          service.reorderSubPaths(parentId, ['a'], 'SUPER_ADMIN'),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.learningPath.updateMany).not.toHaveBeenCalled();
      });

      it('answers 404 for an unknown parent', async () => {
        prisma.learningPath.findUnique.mockResolvedValueOnce(null);

        await expect(service.reorderSubPaths('nope', ['a'], 'SUPER_ADMIN')).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });
    });
  });
});
