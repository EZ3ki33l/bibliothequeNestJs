import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { EntriesService } from './entries.service';
import { ENTRY_CARD_SELECT } from '../common/entry-card.select';
import { EntryAccessService } from '../entry-access/entry-access.service';

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '7.9.1',
  });
}

describe('EntriesService', () => {
  let service: EntriesService;
  const prisma = {
    category: {
      findUnique: jest.fn(),
    },
    entry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };
  const entryAccess = { isFree: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntryAccessService, useValue: entryAccess },
      ],
    }).compile();
    service = module.get(EntriesService);
  });

  describe('findPublished', () => {
    it('returns a paginated envelope of published entries only', async () => {
      const items = [{ id: 'e1', title: 'useState' }];
      prisma.entry.findMany.mockResolvedValue(items);
      prisma.entry.count.mockResolvedValue(1);
      await expect(service.findPublished({ page: 1, limit: 50 })).resolves.toEqual({
        items,
        total: 1,
        page: 1,
        limit: 50,
      });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { published: true },
          skip: 0,
          take: 50,
          select: ENTRY_CARD_SELECT,
        }),
      );
      expect(prisma.entry.count).toHaveBeenCalledWith({ where: { published: true } });
      expect(ENTRY_CARD_SELECT).not.toHaveProperty('bodyMdx');
      expect(ENTRY_CARD_SELECT).not.toHaveProperty('quizQuestions');
      expect(ENTRY_CARD_SELECT).not.toHaveProperty('files');
    });
    it('uses skip from page and take from limit', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);
      await service.findPublished({ page: 2, limit: 10 });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
    it('filters published entries by title, summary, or exact tag when q is set', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);

      await service.findPublished({ page: 1, limit: 50, q: 'useState' });

      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            published: true,
            OR: [
              { title: { contains: 'useState', mode: 'insensitive' } },
              { summary: { contains: 'useState', mode: 'insensitive' } },
              { tags: { has: 'useState' } },
            ],
          },
          select: ENTRY_CARD_SELECT,
        }),
      );
      expect(prisma.entry.count).toHaveBeenCalledWith({
        where: {
          published: true,
          OR: [
            { title: { contains: 'useState', mode: 'insensitive' } },
            { summary: { contains: 'useState', mode: 'insensitive' } },
            { tags: { has: 'useState' } },
          ],
        },
      });
      expect(ENTRY_CARD_SELECT).not.toHaveProperty('bodyMdx');
      expect(ENTRY_CARD_SELECT).not.toHaveProperty('quizQuestions');
    });

    it('never searches nor selects the body, reserved or not', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);

      await service.findPublished({ page: 1, limit: 50, q: 'secret' });

      const { where, select } = prisma.entry.findMany.mock.calls[0][0];
      expect(JSON.stringify(where)).not.toContain('bodyMdx');
      expect(select).toBe(ENTRY_CARD_SELECT);
      expect(entryAccess.isFree).not.toHaveBeenCalled();
    });

    it('trims q and treats whitespace-only q as absent', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);

      await service.findPublished({ page: 1, limit: 50, q: '  hooks  ' });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ tags: { has: 'hooks' } }]),
          }),
        }),
      );

      prisma.entry.findMany.mockClear();
      await service.findPublished({ page: 1, limit: 50, q: '   ' });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { published: true } }),
      );
    });
    it('adds kind and difficulty to the where (AND with q)', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);
      await service.findPublished({
        page: 1,
        limit: 50,
        q: 'hooks',
        kind: 'FUNCTION',
        difficulty: 'BEGINNER',
      });
      const expectedWhere = {
        published: true,
        OR: [
          { title: { contains: 'hooks', mode: 'insensitive' } },
          { summary: { contains: 'hooks', mode: 'insensitive' } },
          { tags: { has: 'hooks' } },
        ],
        kind: 'FUNCTION',
        difficulty: 'BEGINNER',
      };
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      // Le count doit filtrer sur le MÊME where, sinon le total serait faux.
      expect(prisma.entry.count).toHaveBeenCalledWith({ where: expectedWhere });
    });
    it('filters by stack slug via the category relation', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);
      await service.findPublished({
        page: 1,
        limit: 50,
        stack: 'react',
      });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { published: true, category: { stack: { slug: 'react' } } },
        }),
      );
    });
    it('applies a single filter without q (no OR)', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);
      await service.findPublished({
        page: 1,
        limit: 50,
        difficulty: 'ADVANCED',
      });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { published: true, difficulty: 'ADVANCED' },
        }),
      );
    });
    it('filters by an exact tag with has', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);
      await service.findPublished({
        page: 1,
        limit: 50,
        tag: 'hooks',
      });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { published: true, tags: { has: 'hooks' } },
        }),
      );
    });
    it('combines tag with difficulty (intersection)', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);
      await service.findPublished({
        page: 1,
        limit: 50,
        tag: 'hooks',
        difficulty: 'BEGINNER',
      });
      const expectedWhere = {
        published: true,
        difficulty: 'BEGINNER',
        tags: { has: 'hooks' },
      };
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.entry.count).toHaveBeenCalledWith({ where: expectedWhere });
    });
  });

  describe('findPublishedBySlug', () => {
    const header = {
      id: 'e1',
      title: 'useRef',
      slug: 'use-ref',
      summary: 'Garder une valeur entre deux rendus.',
      kind: 'FUNCTION',
      difficulty: 'BEGINNER',
      tags: ['hooks'],
      category: {
        id: 'c1',
        name: 'Hooks',
        slug: 'hooks',
        stack: { id: 's1', name: 'React', slug: 'react' },
      },
    };
    const content = {
      bodyMdx: `${'x'.repeat(80)} NE DOIT PAS FUITER`,
      template: 'react-ts',
      files: { '/App.tsx': 'export default function App() {}' },
      dependencies: { zod: '4.0.0' },
      verifiedOn: new Date('2026-10-06T00:00:00.000Z'),
      verifiedVersion: 'React 19',
      sources: [{ title: 'useRef', consultedOn: null }],
    };

    /**
     * Faux Prisma qui **respecte le `select`** : il ne rend le contenu que si
     * la requête le demande (pas de `select` = toute la ligne). Un simulacre
     * qui renverrait toujours tout cacherait justement la fuite à détecter.
     */
    function findFirstHonouringSelect() {
      prisma.entry.findFirst.mockImplementation((args: { select?: object }) =>
        Promise.resolve(args.select ? header : { ...header, ...content }),
      );
    }

    it('answers the header alone for a reserved entry, in a single query', async () => {
      findFirstHonouringSelect();
      entryAccess.isFree.mockResolvedValue(false);

      await expect(service.findPublishedBySlug('use-ref')).resolves.toEqual({
        ...header,
        access: 'reserved',
      });

      // Une seule lecture : le contenu n'est jamais chargé depuis la base.
      expect(prisma.entry.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.entry.findFirst).toHaveBeenCalledWith({
        where: { slug: 'use-ref', published: true },
        select: ENTRY_CARD_SELECT,
      });
      expect(entryAccess.isFree).toHaveBeenCalledWith('e1');
    });

    it('selects none of the reserved columns for the header', () => {
      for (const column of [
        'bodyMdx',
        'template',
        'files',
        'dependencies',
        'sources',
        'verifiedOn',
        'verifiedVersion',
        'quizQuestions',
      ]) {
        expect(ENTRY_CARD_SELECT).not.toHaveProperty(column);
      }
    });

    it('leaks nothing of the content of a reserved entry, quizEligible included', async () => {
      findFirstHonouringSelect();
      entryAccess.isFree.mockResolvedValue(false);

      const response = await service.findPublishedBySlug('use-ref');

      for (const key of [
        'bodyMdx',
        'template',
        'files',
        'dependencies',
        'sources',
        'verifiedOn',
        'verifiedVersion',
        'quizEligible',
      ]) {
        expect(response).not.toHaveProperty(key);
      }
      expect(JSON.stringify(response)).not.toContain('NE DOIT PAS FUITER');
    });

    it('answers the whole entry for a free one, marked access free', async () => {
      findFirstHonouringSelect();
      entryAccess.isFree.mockResolvedValue(true);

      await expect(service.findPublishedBySlug('use-reducer')).resolves.toEqual({
        ...header,
        ...content,
        verifiedOn: '2026-10-06',
        quizEligible: true,
        access: 'free',
      });

      // En-tête d'abord, fiche entière ensuite : la seconde lecture n'a lieu
      // qu'une fois la fiche établie comme libre.
      expect(prisma.entry.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.entry.findFirst.mock.calls[1][0]).toMatchObject({
        where: { slug: 'use-reducer', published: true },
        omit: { quizQuestions: true },
      });
    });

    it('throws NotFoundException for a draft or an unknown slug, before the access rule', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.findPublishedBySlug('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(entryAccess.isFree).not.toHaveBeenCalled();
      expect(prisma.entry.findFirst).toHaveBeenCalledTimes(1);
    });

    it('lets the access rule fail : nothing is answered, nothing more is read', async () => {
      findFirstHonouringSelect();
      entryAccess.isFree.mockRejectedValue(new Error('connexion perdue'));

      await expect(service.findPublishedBySlug('use-ref')).rejects.toThrow('connexion perdue');
      expect(prisma.entry.findFirst).toHaveBeenCalledTimes(1);
    });

    it('answers 404 when the entry is unpublished between the two reads', async () => {
      prisma.entry.findFirst.mockResolvedValueOnce(header).mockResolvedValueOnce(null);
      entryAccess.isFree.mockResolvedValue(true);

      await expect(service.findPublishedBySlug('use-ref')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findReadableBySlug', () => {
    it('returns the published entry with its sources, in order', async () => {
      prisma.entry.findFirst.mockResolvedValue({
        id: 'e1',
        slug: 'use-state',
        published: true,
        bodyMdx: '',
        verifiedOn: null,
        sources: [],
      });

      await expect(service.findReadableBySlug('use-state')).resolves.toEqual({
        id: 'e1',
        slug: 'use-state',
        published: true,
        bodyMdx: '',
        verifiedOn: null,
        sources: [],
        quizEligible: false,
      });
      expect(prisma.entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'use-state', published: true },
          omit: { quizQuestions: true },
        }),
      );

      const { include } = prisma.entry.findFirst.mock.calls[0][0];
      expect(include.sources.orderBy).toEqual({ position: 'asc' });
      // Ni identifiant ni rang : l'ordre du tableau suffit au client.
      expect(include.sources.select).not.toHaveProperty('id');
      expect(include.sources.select).not.toHaveProperty('entryId');
      expect(include.sources.select).not.toHaveProperty('position');
    });

    it('answers calendar days (AAAA-MM-JJ), never timestamps', async () => {
      prisma.entry.findFirst.mockResolvedValue({
        id: 'e1',
        bodyMdx: '',
        verifiedOn: new Date('2026-10-06T00:00:00.000Z'),
        sources: [
          { title: 'useState', consultedOn: new Date('2026-09-30T00:00:00.000Z') },
          { title: 'Hooks', consultedOn: null },
        ],
      });

      await expect(service.findReadableBySlug('use-state')).resolves.toEqual({
        id: 'e1',
        bodyMdx: '',
        verifiedOn: '2026-10-06',
        sources: [
          { title: 'useState', consultedOn: '2026-09-30' },
          { title: 'Hooks', consultedOn: null },
        ],
        quizEligible: false,
      });
    });

    it('says whether a quiz exists for the entry, with the shared eligibility rule', async () => {
      const entry = { id: 'e1', verifiedOn: null, sources: [] };

      prisma.entry.findFirst.mockResolvedValue({ ...entry, bodyMdx: 'x'.repeat(79) });
      await expect(service.findReadableBySlug('courte')).resolves.toMatchObject({
        quizEligible: false,
      });

      // Les espaces de bord ne comptent pas : 80 caractères utiles, pas 80 octets.
      prisma.entry.findFirst.mockResolvedValue({ ...entry, bodyMdx: `  ${'x'.repeat(79)}  ` });
      await expect(service.findReadableBySlug('courte')).resolves.toMatchObject({
        quizEligible: false,
      });

      prisma.entry.findFirst.mockResolvedValue({ ...entry, bodyMdx: 'x'.repeat(80) });
      await expect(service.findReadableBySlug('longue')).resolves.toMatchObject({
        quizEligible: true,
      });
    });

    it('throws NotFoundException when missing or unpublished', async () => {
      prisma.entry.findFirst.mockResolvedValue(null);

      await expect(service.findReadableBySlug('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('never consults the access rule : the guard of the route decides', async () => {
      prisma.entry.findFirst.mockResolvedValue({
        id: 'e1',
        bodyMdx: '',
        verifiedOn: null,
        sources: [],
      });

      await expect(service.findReadableBySlug('use-ref')).resolves.not.toHaveProperty('access');
      expect(entryAccess.isFree).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const dto = {
      categoryId: 'cat-1',
      title: 'use State',
      kind: 'FUNCTION' as const,
    };

    it('throws NotFoundException when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 'SUPER_ADMIN')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.entry.create).not.toHaveBeenCalled();
    });

    it('applies defaults, next position, and slugified title', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: 2 } });
      prisma.entry.create.mockResolvedValue({ id: 'e1' });

      await service.create(dto, 'SUPER_ADMIN');

      expect(prisma.entry.create).toHaveBeenCalledWith({
        data: {
          categoryId: 'cat-1',
          title: 'use State',
          slug: 'use-state',
          summary: '',
          bodyMdx: '',
          kind: 'FUNCTION',
          difficulty: 'BEGINNER',
          tags: [],
          published: false,
          position: 3,
          template: 'react-ts',
          files: {},
          dependencies: undefined,
        },
      });
    });

    it('uses provided optionals and position 0 when the category is empty', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockResolvedValue({ id: 'e1' });

      await service.create(
        {
          ...dto,
          summary: 'hook',
          bodyMdx: '# md',
          difficulty: 'ADVANCED',
          tags: ['hooks'],
          published: true,
          template: 'vanilla',
          files: { 'App.tsx': 'x' },
          dependencies: { react: '19' },
        },
        'SUPER_ADMIN',
      );

      expect(prisma.entry.create).toHaveBeenCalledWith({
        data: {
          categoryId: 'cat-1',
          title: 'use State',
          slug: 'use-state',
          summary: 'hook',
          bodyMdx: '# md',
          kind: 'FUNCTION',
          difficulty: 'ADVANCED',
          tags: ['hooks'],
          published: true,
          position: 0,
          template: 'vanilla',
          files: { 'App.tsx': 'x' },
          dependencies: { react: '19' },
        },
      });
    });

    it('creates the sources with the entry, ranked by their index', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockResolvedValue({ id: 'e1' });

      await service.create(
        {
          ...dto,
          verifiedOn: '2026-10-06',
          verifiedVersion: 'React 19',
          sources: [
            {
              title: 'useState',
              url: 'https://react.dev/reference/react/useState',
              publisher: 'react.dev',
              consultedOn: '2026-09-30',
              licenseName: 'CC BY 4.0',
              licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
              adapted: true,
            },
            { title: 'Hooks', url: 'https://react.dev/reference/react/hooks' },
          ],
        },
        'SUPER_ADMIN',
      );

      const { data } = prisma.entry.create.mock.calls[0][0];
      expect(data.verifiedOn).toEqual(new Date('2026-10-06T00:00:00.000Z'));
      expect(data.verifiedVersion).toBe('React 19');
      expect(data.sources).toEqual({
        create: [
          {
            position: 0,
            title: 'useState',
            url: 'https://react.dev/reference/react/useState',
            publisher: 'react.dev',
            consultedOn: new Date('2026-09-30T00:00:00.000Z'),
            licenseName: 'CC BY 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
            adapted: true,
          },
          {
            position: 1,
            title: 'Hooks',
            url: 'https://react.dev/reference/react/hooks',
            publisher: '',
            consultedOn: null,
            licenseName: '',
            licenseUrl: '',
            adapted: false,
          },
        ],
      });
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.create(dto, 'SUPER_ADMIN')).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected Prisma codes', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockRejectedValue(knownRequestError('P2010'));

      await expect(service.create(dto, 'SUPER_ADMIN')).rejects.toMatchObject({ code: 'P2010' });
    });

    it('rethrows non-Prisma errors', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockRejectedValue(new Error('db down'));

      await expect(service.create(dto, 'SUPER_ADMIN')).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    it('recomputes the slug from the title and never sends categoryId', async () => {
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update(
        'e1',
        {
          title: 'New Title',
          summary: 's',
          bodyMdx: 'b',
          kind: 'COMPONENT',
          difficulty: 'ADVANCED',
          tags: ['a'],
          published: true,
          template: 'vue',
          files: { a: '1' },
          dependencies: { b: '2' },
        },
        'SUPER_ADMIN',
      );

      expect(prisma.entry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: {
          title: 'New Title',
          slug: 'new-title',
          summary: 's',
          bodyMdx: 'b',
          kind: 'COMPONENT',
          difficulty: 'ADVANCED',
          tags: ['a'],
          published: true,
          template: 'vue',
          files: { a: '1' },
          dependencies: { b: '2' },
        },
      });
    });

    it('sends an empty data object when no field is provided', async () => {
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update('e1', {}, 'SUPER_ADMIN');

      expect(prisma.entry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: {},
      });
    });

    it('replaces the whole source list in the same write', async () => {
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update(
        'e1',
        { sources: [{ title: 'useState', url: 'https://react.dev/reference/react/useState' }] },
        'SUPER_ADMIN',
      );

      expect(prisma.entry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: {
          sources: {
            deleteMany: {},
            create: [
              {
                position: 0,
                title: 'useState',
                url: 'https://react.dev/reference/react/useState',
                publisher: '',
                consultedOn: null,
                licenseName: '',
                licenseUrl: '',
                adapted: false,
              },
            ],
          },
        },
      });
    });

    it('removes every source when the list is empty', async () => {
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update('e1', { sources: [] }, 'SUPER_ADMIN');

      expect(prisma.entry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { sources: { deleteMany: {}, create: [] } },
      });
    });

    it('leaves sources and verification untouched when they are not sent', async () => {
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update('e1', { published: true }, 'SUPER_ADMIN');

      const { data } = prisma.entry.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('sources');
      expect(data).not.toHaveProperty('verifiedOn');
      expect(data).not.toHaveProperty('verifiedVersion');
    });

    it('writes the verification day and version, and clears the day on null', async () => {
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update(
        'e1',
        { verifiedOn: '2026-10-06', verifiedVersion: 'React 19' },
        'SUPER_ADMIN',
      );
      await service.update('e1', { verifiedOn: null, verifiedVersion: '' }, 'SUPER_ADMIN');

      expect(prisma.entry.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'e1' },
        data: { verifiedOn: new Date('2026-10-06T00:00:00.000Z'), verifiedVersion: 'React 19' },
      });
      expect(prisma.entry.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'e1' },
        data: { verifiedOn: null, verifiedVersion: '' },
      });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.entry.update.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.update('e1', { summary: 'x' }, 'SUPER_ADMIN')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.entry.update.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.update('e1', { title: 'Taken' }, 'SUPER_ADMIN')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unexpected errors', async () => {
      prisma.entry.update.mockRejectedValue(new Error('db down'));

      await expect(service.update('e1', {}, 'SUPER_ADMIN')).rejects.toThrow('db down');
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      prisma.entry.delete.mockResolvedValue({ id: 'e1' });

      await expect(service.delete('e1', 'SUPER_ADMIN')).resolves.toBeUndefined();
      expect(prisma.entry.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.entry.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.delete('missing', 'SUPER_ADMIN')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rethrows unexpected errors', async () => {
      prisma.entry.delete.mockRejectedValue(new Error('db down'));

      await expect(service.delete('e1', 'SUPER_ADMIN')).rejects.toThrow('db down');
    });
  });

  describe('findAllAdmin', () => {
    it('returns a paginated envelope including drafts', async () => {
      const items = [{ id: 'e1', published: false }];
      prisma.entry.findMany.mockResolvedValue(items);
      prisma.entry.count.mockResolvedValue(51);

      await expect(service.findAllAdmin(2, 50)).resolves.toEqual({
        items,
        total: 51,
        page: 2,
        limit: 50,
      });
      expect(prisma.entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 50 }),
      );
      // Aucun filtre : `where` vide, donc aucune contrainte.
      expect(prisma.entry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(prisma.entry.count).toHaveBeenCalledWith({ where: {} });
    });

    it('filters by title (case-insensitive) on both list and count when q is set', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);

      await service.findAllAdmin(1, 50, { q: '  useSt  ' });

      const where = { title: { contains: 'useSt', mode: 'insensitive' } };
      expect(prisma.entry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
      expect(prisma.entry.count).toHaveBeenCalledWith({ where });
    });

    it('treats a blank q as absent', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);

      await service.findAllAdmin(1, 50, { q: '   ' });

      expect(prisma.entry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(prisma.entry.count).toHaveBeenCalledWith({ where: {} });
    });

    it.each([
      ['draft', false],
      ['published', true],
    ] as const)('filters by status %s', async (status, published) => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);

      await service.findAllAdmin(1, 50, { status });

      const where = { published };
      expect(prisma.entry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
      expect(prisma.entry.count).toHaveBeenCalledWith({ where });
    });

    it('combines stack, category and path filters on both list and count', async () => {
      prisma.entry.findMany.mockResolvedValue([]);
      prisma.entry.count.mockResolvedValue(0);

      await service.findAllAdmin(1, 50, {
        status: 'draft',
        stackId: 's1',
        categoryId: 'c1',
        pathId: 'p1',
      });

      const where = {
        published: false,
        categoryId: 'c1',
        category: { stackId: 's1' },
        pathSteps: { some: { pathId: 'p1' } },
      };
      expect(prisma.entry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
      expect(prisma.entry.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('findById', () => {
    it('returns the entry, drafts included, with sources and calendar days', async () => {
      prisma.entry.findUnique.mockResolvedValue({
        id: 'e1',
        title: 'useState',
        verifiedOn: new Date('2026-10-06T00:00:00.000Z'),
        sources: [{ title: 'useState', consultedOn: null }],
      });

      await expect(service.findById('e1')).resolves.toEqual({
        id: 'e1',
        title: 'useState',
        verifiedOn: '2026-10-06',
        sources: [{ title: 'useState', consultedOn: null }],
      });

      const { select } = prisma.entry.findUnique.mock.calls[0][0];
      expect(select.verifiedOn).toBe(true);
      expect(select.verifiedVersion).toBe(true);
      expect(select.sources.orderBy).toEqual({ position: 'asc' });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.entry.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('ADMIN role (drafts only)', () => {
    it('refuses to create a published entry, before any database call', async () => {
      await expect(
        service.create(
          { categoryId: 'c1', title: 'useState', kind: 'FUNCTION', published: true },
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(prisma.entry.create).not.toHaveBeenCalled();
    });

    it('creates a draft', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.entry.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.entry.create.mockResolvedValue({ id: 'e1' });

      await service.create({ categoryId: 'c1', title: 'useState', kind: 'FUNCTION' }, 'ADMIN');

      expect(prisma.entry.create.mock.calls[0][0].data.published).toBe(false);
    });

    it('refuses to publish a draft', async () => {
      await expect(service.update('e1', { published: true }, 'ADMIN')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.entry.update).not.toHaveBeenCalled();
    });

    it('refuses to edit a published entry, even to unpublish it', async () => {
      prisma.entry.findUnique.mockResolvedValue({ published: true });

      await expect(service.update('e1', { published: false }, 'ADMIN')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.entry.findUnique).toHaveBeenCalledWith({
        where: { id: 'e1' },
        select: { published: true },
      });
      expect(prisma.entry.update).not.toHaveBeenCalled();
    });

    it('edits a draft', async () => {
      prisma.entry.findUnique.mockResolvedValue({ published: false });
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update('e1', { summary: 'x', published: false }, 'ADMIN');

      expect(prisma.entry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { summary: 'x', published: false },
      });
    });

    it('refuses to change the sources or the verification of a published entry', async () => {
      prisma.entry.findUnique.mockResolvedValue({ published: true });

      await expect(
        service.update(
          'e1',
          { sources: [{ title: 'useState', url: 'https://react.dev' }] },
          'ADMIN',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.update('e1', { verifiedOn: '2026-10-06', verifiedVersion: 'React 19' }, 'ADMIN'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.entry.update).not.toHaveBeenCalled();
    });

    it('edits the sources of a draft', async () => {
      prisma.entry.findUnique.mockResolvedValue({ published: false });
      prisma.entry.update.mockResolvedValue({ id: 'e1' });

      await service.update('e1', { sources: [] }, 'ADMIN');

      expect(prisma.entry.update).toHaveBeenCalledTimes(1);
    });

    it('refuses to delete a published entry', async () => {
      prisma.entry.findUnique.mockResolvedValue({ published: true });

      await expect(service.delete('e1', 'ADMIN')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.entry.delete).not.toHaveBeenCalled();
    });

    it('deletes a draft', async () => {
      prisma.entry.findUnique.mockResolvedValue({ published: false });
      prisma.entry.delete.mockResolvedValue({ id: 'e1' });

      await expect(service.delete('e1', 'ADMIN')).resolves.toBeUndefined();
      expect(prisma.entry.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });

    it('answers 404, not 403, for an unknown entry', async () => {
      prisma.entry.findUnique.mockResolvedValue(null);
      prisma.entry.delete.mockRejectedValue(knownRequestError('P2025'));

      await expect(service.delete('missing', 'ADMIN')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('SUPER_ADMIN writes published entries without the lock lookup', async () => {
    prisma.entry.delete.mockResolvedValue({ id: 'e1' });

    await service.delete('e1', 'SUPER_ADMIN');

    expect(prisma.entry.findUnique).not.toHaveBeenCalled();
  });
});
