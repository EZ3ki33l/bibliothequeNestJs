import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../src/app.module';

/**
 * Fiches simulées pour les lectures publiques : une fiche en accès libre, une
 * fiche réservée, un brouillon. `RESERVED_BODY_MARKER` est le texte qui ne doit
 * apparaître dans aucune réponse faite sans droit de lecture.
 */
export const RESERVED_BODY_MARKER = 'CONTENU RÉSERVÉ : NE DOIT PAS SORTIR';

export const FREE_ENTRY = {
  id: '00000000-0000-4000-8000-00000000000a',
  slug: 'use-reducer',
  title: 'useReducer',
};
export const RESERVED_ENTRY = {
  id: '00000000-0000-4000-8000-00000000000b',
  slug: 'use-ref',
  title: 'useRef',
};
export const DRAFT_ENTRY = {
  id: '00000000-0000-4000-8000-00000000000c',
  slug: 'brouillon',
  title: 'Brouillon',
};

type EntryRow = Record<string, unknown> & { id: string; slug: string; published: boolean };

function entryRow(entry: typeof FREE_ENTRY, published: boolean, bodyMdx: string): EntryRow {
  return {
    ...entry,
    summary: 'Résumé public.',
    kind: 'FUNCTION',
    difficulty: 'BEGINNER',
    tags: ['hooks'],
    category: {
      id: 'c1',
      name: 'Hooks',
      slug: 'hooks',
      stack: { id: 's1', name: 'React', slug: 'react' },
    },
    published,
    bodyMdx,
    template: 'react-ts',
    files: { '/App.tsx': bodyMdx },
    dependencies: {},
    verifiedOn: null,
    verifiedVersion: null,
    sources: [],
  };
}

const ENTRIES: EntryRow[] = [
  entryRow(FREE_ENTRY, true, 'Contenu en accès libre.'),
  entryRow(RESERVED_ENTRY, true, RESERVED_BODY_MARKER),
  entryRow(DRAFT_ENTRY, false, 'Brouillon.'),
];

/** Un parcours publié : la fiche libre ouvre le premier module, la réservée vient après. */
const ACCESS_PATHS = [
  {
    modules: [{ steps: [{ entryId: FREE_ENTRY.id }] }, { steps: [{ entryId: RESERVED_ENTRY.id }] }],
  },
];

type EntryWhere = { id?: string | { in: string[] }; slug?: string; published?: boolean };

function matches(row: EntryRow, where: EntryWhere = {}): boolean {
  const ids = typeof where.id === 'string' ? [where.id] : where.id?.in;

  return (
    (ids === undefined || ids.includes(row.id)) &&
    (where.slug === undefined || where.slug === row.slug) &&
    (where.published === undefined || where.published === row.published)
  );
}

/**
 * Ne renvoie que les colonnes demandées par `select`, comme Prisma. Sans
 * `select` (lecture par `include` / `omit`), toute la ligne sort.
 *
 * C'est ce qui donne sa valeur au test de la lecture réduite : un simulacre
 * qui ignorerait `select` renverrait le corps quoi que fasse le service, et
 * l'absence de `bodyMdx` dans la réponse ne prouverait rien.
 */
function pick(row: EntryRow, select?: Record<string, unknown>): Record<string, unknown> {
  if (!select) {
    return row;
  }

  return Object.fromEntries(Object.keys(select).map((column) => [column, row[column]]));
}

type EntryArgs = { where?: EntryWhere; select?: Record<string, unknown> };

export async function createAdminE2eApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      $connect: () => Promise.resolve(),
      $disconnect: () => Promise.resolve(),
      admin: { findUnique: () => Promise.resolve(null) },
      // `GET /learning-paths` est public : sans ce mock, il atteindrait Prisma.
      // La règle d'accès lit aussi les parcours, mais avec leurs modules :
      // c'est ce `select` qui distingue les deux lectures.
      learningPath: {
        findMany: (args?: { select?: { modules?: unknown } }) =>
          Promise.resolve(args?.select?.modules ? ACCESS_PATHS : []),
        count: () => Promise.resolve(0),
      },
      entry: {
        findFirst: (args: EntryArgs = {}) => {
          const row = ENTRIES.find((entry) => matches(entry, args.where));
          return Promise.resolve(row ? pick(row, args.select) : null);
        },
        findMany: (args: EntryArgs = {}) =>
          Promise.resolve(
            ENTRIES.filter((entry) => matches(entry, args.where)).map((entry) =>
              pick(entry, args.select),
            ),
          ),
      },
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
