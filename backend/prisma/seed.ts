import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, EntryKind, AdminRole } from '../src/generated/prisma/client';
import { HOOK_ENTRIES, demoSourceRows, type DemoEntry } from './demo-entries';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * Crée la fiche ou réécrit son contenu : relancer le seed rafraîchit le
 * contenu pédagogique sans créer de doublon (le slug est unique).
 *
 * Les sources sont remplacées en entier, par une écriture imbriquée : elles
 * sont enregistrées dans la même transaction que la fiche.
 */
async function upsertHookEntry(categoryId: string, entry: DemoEntry) {
  const sources = demoSourceRows(entry.sources);
  const data = {
    categoryId,
    title: entry.title,
    summary: entry.summary,
    bodyMdx: entry.bodyMdx,
    kind: EntryKind.FUNCTION,
    difficulty: entry.difficulty,
    tags: entry.tags,
    published: true,
    position: entry.position,
    template: 'react-ts',
    files: entry.files,
  };

  await prisma.entry.upsert({
    where: { slug: entry.slug },
    update: { ...data, sources: { deleteMany: {}, create: sources } },
    create: { ...data, slug: entry.slug, sources: { create: sources } },
  });
}

/**
 * Parcours de démonstration : il rend `/parcours` testable sans passer par
 * l'administration.
 *
 * Les modules sont supprimés puis recréés à chaque seed (leurs étapes partent
 * en cascade) : relancer le seed remet le parcours dans son état de référence,
 * sans doublon. Une modification faite à la main sur **ce** parcours est donc
 * écrasée, comme le contenu des fiches de démonstration.
 */
const DEMO_PATH = {
  slug: 'maitriser-les-hooks-react',
  name: 'Maîtriser les hooks React',
  description:
    "Un ordre conseillé pour découvrir les hooks de base : d'abord l'état local, puis les effets et l'optimisation.",
  modules: [
    {
      title: 'États locaux',
      description: 'Stocker et partager un état dans les composants.',
      steps: [
        { slug: 'use-state-compteur', optional: false },
        { slug: 'use-reducer', optional: false },
        { slug: 'use-context', optional: false },
      ],
    },
    {
      title: 'Effets et optimisation',
      description: 'Synchroniser avec l’extérieur et éviter les calculs inutiles.',
      steps: [
        { slug: 'use-ref', optional: false },
        { slug: 'use-effect', optional: false },
        { slug: 'use-memo', optional: false },
        { slug: 'use-callback', optional: true },
      ],
    },
  ],
};

async function upsertDemoPath() {
  const data = { name: DEMO_PATH.name, description: DEMO_PATH.description, published: true };
  const path = await prisma.learningPath.upsert({
    where: { slug: DEMO_PATH.slug },
    update: data,
    create: { ...data, slug: DEMO_PATH.slug, position: 0 },
  });

  await prisma.pathModule.deleteMany({ where: { pathId: path.id } });

  for (const [moduleIndex, module] of DEMO_PATH.modules.entries()) {
    const created = await prisma.pathModule.create({
      data: {
        pathId: path.id,
        title: module.title,
        description: module.description,
        position: moduleIndex,
      },
    });

    for (const [stepIndex, step] of module.steps.entries()) {
      const entry = await prisma.entry.findUniqueOrThrow({ where: { slug: step.slug } });
      await prisma.pathStep.create({
        data: {
          pathId: path.id,
          moduleId: created.id,
          entryId: entry.id,
          optional: step.optional,
          position: stepIndex,
        },
      });
    }
  }
}

async function main() {
  const stack = await prisma.stack.upsert({
    where: { slug: 'react' },
    update: {
      name: 'React',
      description: 'Hooks, composants et patterns React',
    },
    create: {
      name: 'React',
      slug: 'react',
      description: 'Hooks, composants et patterns React',
      position: 0,
    },
  });

  const category = await prisma.category.upsert({
    where: {
      stackId_slug: { stackId: stack.id, slug: 'hooks' },
    },
    update: {
      name: 'Hooks',
      description: 'Les hooks de base : état, contexte, refs, effets et performance (react.dev).',
    },
    create: {
      stackId: stack.id,
      name: 'Hooks',
      slug: 'hooks',
      description: 'Les hooks de base : état, contexte, refs, effets et performance (react.dev).',
      position: 0,
    },
  });

  for (const entry of HOOK_ENTRIES) {
    await upsertHookEntry(category.id, entry);
  }

  await upsertDemoPath();

  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.warn('ADMIN_EMAIL manquant : aucun admin promu');
  } else {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn(
        `Aucun compte pour ${email}. Inscription sur /register, puis relancer : pnpm exec prisma db seed`,
      );
    } else {
      await prisma.admin.upsert({
        where: { userId: user.id },
        update: { role: AdminRole.SUPER_ADMIN },
        create: { userId: user.id, role: AdminRole.SUPER_ADMIN },
      });
      console.log(`Admin : ${email} - SUPER_ADMIN`);
    }
  }
  console.log(
    `SEED OK : stack React / catégorie Hooks / ${HOOK_ENTRIES.length} fiches (hooks de base) / parcours « ${DEMO_PATH.name} »`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
