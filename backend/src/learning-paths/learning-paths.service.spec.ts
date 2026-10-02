import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  LearningPathsService,
  MAX_MODULES_PER_PATH,
  MAX_STEPS_PER_PATH,
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
  modules: [],
};

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
    it('lists published paths only, in admin order, paginated', async () => {
      prisma.learningPath.findMany.mockResolvedValue([]);
      prisma.learningPath.count.mockResolvedValue(0);

      await service.findPublished(2, 10);

      const call = prisma.learningPath.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ published: true });
      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
      expect(call.orderBy).toEqual([{ position: 'asc' }, { name: 'asc' }]);
      expect(prisma.learningPath.count).toHaveBeenCalledWith({ where: { published: true } });
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
        { id: 'p1', name: 'Web', slug: 'web', description: '', _count: { steps: 7 } },
      ]);
      prisma.learningPath.count.mockResolvedValue(1);

      const result = await service.findPublished(1, 50);

      expect(result).toEqual({
        items: [{ id: 'p1', name: 'Web', slug: 'web', description: '', stepCount: 7 }],
        total: 1,
        page: 1,
        limit: 50,
      });
    });
  });

  describe('findPublishedBySlug', () => {
    it('looks up a published path by slug', async () => {
      prisma.learningPath.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Web',
        slug: 'web',
        description: '',
        modules: [],
      });

      await service.findPublishedBySlug('web');

      const call = prisma.learningPath.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({ slug: 'web', published: true });
    });

    it('throws 404 when the path is unknown or a draft', async () => {
      prisma.learningPath.findFirst.mockResolvedValue(null);

      await expect(service.findPublishedBySlug('brouillon')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('orders modules and steps, hides draft entries, never selects the body', async () => {
      prisma.learningPath.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Web',
        slug: 'web',
        description: '',
        modules: [],
      });

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
      prisma.learningPath.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Web',
        slug: 'web',
        description: '',
        modules: [visible, empty],
      });

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
          _count: { modules: 2, steps: 5 },
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
          moduleCount: 2,
          stepCount: 5,
        },
      ]);
      expect(result.total).toBe(1);
    });
  });

  describe('findAdminDetail', () => {
    it('returns every step, drafts included, with entry.published', async () => {
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await expect(service.findAdminDetail(pathId)).resolves.toBe(detail);

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

      await expect(service.create({ name: 'Développement Web' })).resolves.toBe(detail);

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

      await service.update(pathId, { name: 'Python', published: true });

      expect(prisma.learningPath.update).toHaveBeenCalledWith({
        where: { id: pathId },
        data: { name: 'Python', slug: 'python', published: true },
        select: { id: true },
      });
    });

    it('only writes the provided fields', async () => {
      prisma.learningPath.update.mockResolvedValue({ id: pathId });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.update(pathId, { description: 'Nouvelle description' });

      expect(prisma.learningPath.update.mock.calls[0][0].data).toEqual({
        description: 'Nouvelle description',
      });
    });

    it('maps an unknown id to 404', async () => {
      prisma.learningPath.update.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.update('nope', { published: true })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('deletes the path only (entries untouched)', async () => {
      prisma.learningPath.delete.mockResolvedValue({ id: pathId });

      await service.delete(pathId);

      expect(prisma.learningPath.delete).toHaveBeenCalledWith({ where: { id: pathId } });
    });

    it('maps an unknown id to 404', async () => {
      prisma.learningPath.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.delete('nope')).rejects.toBeInstanceOf(NotFoundException);
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

      await expect(service.addModule(pathId, { title: 'Bases' })).resolves.toBe(detail);

      expect(prisma.pathModule.create).toHaveBeenCalledWith({
        data: { pathId, title: 'Bases', description: '', position: 2 },
      });
    });

    it('refuses beyond the module cap with 409', async () => {
      prisma.pathModule.count.mockResolvedValue(MAX_MODULES_PER_PATH);
      prisma.pathModule.aggregate.mockResolvedValue({ _max: { position: 29 } });

      await expect(service.addModule(pathId, { title: 'Trop' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.pathModule.create).not.toHaveBeenCalled();
    });
  });

  it('addModule throws 404 for an unknown path', async () => {
    prisma.learningPath.findUnique.mockResolvedValue(null);

    await expect(service.addModule('nope', { title: 'Bases' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('updateModule / deleteModule', () => {
    it('scopes the update to the parent path', async () => {
      prisma.pathModule.updateMany.mockResolvedValue({ count: 1 });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.updateModule(pathId, moduleId, { title: 'Renommé' });

      expect(prisma.pathModule.updateMany).toHaveBeenCalledWith({
        where: { id: moduleId, pathId },
        data: { title: 'Renommé', description: undefined },
      });
    });

    it('404 when the module belongs to another path', async () => {
      prisma.pathModule.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateModule(pathId, 'foreign-module', { title: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes scoped to the parent path', async () => {
      prisma.pathModule.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteModule(pathId, moduleId);

      expect(prisma.pathModule.deleteMany).toHaveBeenCalledWith({
        where: { id: moduleId, pathId },
      });
    });

    it('delete: 404 when nothing matched', async () => {
      prisma.pathModule.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteModule(pathId, 'nope')).rejects.toBeInstanceOf(NotFoundException);
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

      await expect(service.reorderModules(pathId, ['m2', 'm1'])).resolves.toBe(detail);

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
      await expect(service.reorderModules(pathId, ['m1'])).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.pathModule.updateMany).not.toHaveBeenCalled();
    });

    it('409 when the list contains a foreign module', async () => {
      await expect(service.reorderModules(pathId, ['m1', 'other'])).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('409 when a module disappears between read and write', async () => {
      prisma.pathModule.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(service.reorderModules(pathId, ['m1', 'm2'])).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('reorderModules throws 404 for an unknown path', async () => {
    prisma.learningPath.findUnique.mockResolvedValue(null);

    await expect(service.reorderModules('nope', ['m1'])).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('addStep', () => {
    const entryId = 'entry-1';

    it('copies pathId from the module and appends at the end of the module', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue({ id: entryId });
      prisma.pathStep.count.mockResolvedValue(3);
      prisma.pathStep.aggregate.mockResolvedValue({ _max: { position: 2 } });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await expect(service.addStep(pathId, moduleId, { entryId })).resolves.toBe(detail);

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

      await service.addStep(pathId, moduleId, { entryId, optional: true });

      expect(prisma.pathStep.create.mock.calls[0][0].data).toMatchObject({
        optional: true,
        position: 0,
      });
    });

    it('404 when the module belongs to another path', async () => {
      prisma.pathModule.findFirst.mockResolvedValue(null);

      await expect(service.addStep(pathId, 'foreign', { entryId })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.pathStep.create).not.toHaveBeenCalled();
    });

    it('404 when the entry is unknown', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue(null);

      await expect(service.addStep(pathId, moduleId, { entryId })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('409 beyond the step cap', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue({ id: entryId });
      prisma.pathStep.count.mockResolvedValue(MAX_STEPS_PER_PATH);
      prisma.pathStep.aggregate.mockResolvedValue({ _max: { position: 10 } });

      await expect(service.addStep(pathId, moduleId, { entryId })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.pathStep.create).not.toHaveBeenCalled();
    });

    it('409 when the entry is already in this path (unique constraint)', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.entry.findUnique.mockResolvedValue({ id: entryId });
      prisma.pathStep.count.mockResolvedValue(1);
      prisma.pathStep.aggregate.mockResolvedValue({ _max: { position: 0 } });
      prisma.pathStep.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.addStep(pathId, moduleId, { entryId })).rejects.toThrow(
        'Cette fiche est déjà dans ce parcours',
      );
    });
  });

  describe('updateStep / deleteStep', () => {
    it('scopes the update to the parent path', async () => {
      prisma.pathStep.updateMany.mockResolvedValue({ count: 1 });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await service.updateStep(pathId, 'step-1', { optional: true });

      expect(prisma.pathStep.updateMany).toHaveBeenCalledWith({
        where: { id: 'step-1', pathId },
        data: { optional: true },
      });
    });

    it('update: 404 when nothing matched', async () => {
      prisma.pathStep.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updateStep(pathId, 'nope', { optional: true })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes scoped to the parent path, never the entry', async () => {
      prisma.pathStep.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteStep(pathId, 'step-1');

      expect(prisma.pathStep.deleteMany).toHaveBeenCalledWith({ where: { id: 'step-1', pathId } });
    });

    it('delete: 404 when nothing matched', async () => {
      prisma.pathStep.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteStep(pathId, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reorderSteps', () => {
    it('checks the module belongs to the path, then writes positions', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.pathStep.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      prisma.pathStep.updateMany.mockResolvedValue({ count: 1 });
      prisma.learningPath.findUnique.mockResolvedValue(detail);

      await expect(service.reorderSteps(pathId, moduleId, ['s2', 's1'])).resolves.toBe(detail);

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

      await expect(service.reorderSteps(pathId, 'foreign', ['s1'])).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('409 when the list is not the exact current set', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.pathStep.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

      await expect(
        service.reorderSteps(pathId, moduleId, ['s1', 's2', 's3']),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('409 when a step disappears between read and write', async () => {
      prisma.pathModule.findFirst.mockResolvedValue({ id: moduleId });
      prisma.pathStep.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.pathStep.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.reorderSteps(pathId, moduleId, ['s1'])).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
