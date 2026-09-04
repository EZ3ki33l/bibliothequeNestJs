import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, EntryKind, Difficulty, AdminRole } from '../src/generated/prisma/client';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const counterFiles = {
  '/App.tsx': `import {useState} from "react";
    
    export default function App() {
    const [count, setCount] = useState(0);
    
    return (
    <button onClick={() => setCount((c) => c + 1)}>
    Cliqué {count} fois
    </button>
    )
    }
    `,
};

async function main() {
  const stack = await prisma.stack.upsert({
    where: { slug: 'react' },
    update: {},
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
    update: {},
    create: {
      stackId: stack.id,
      name: 'Hooks',
      slug: 'hooks',
      description: 'État, effets et hooks personnalisés.',
      position: 0,
    },
  });

  await prisma.entry.upsert({
    where: { slug: 'use-state-compteur' },
    update: {},
    create: {
      categoryId: category.id,
      title: 'useState - compteur',
      slug: 'use-state-compteur',
      summary: "Le hook d'état le plus simple : un compteur cliquable",
      bodyMdx: `## Idée
\`useState\` garde une valeur entre les rendus et déclenche un re-render quand tu appelles le setter.
## À retenir
- \`count\` est la valeur actuelle
- \`setCount\` la met à jour
- Passe une fonction \`setCount(c => c + 1)\` si la nouvelle valeur dépend de l’ancienne
`,
      kind: EntryKind.FUNCTION,
      difficulty: Difficulty.BEGINNER,
      tags: ['react', 'hooks', 'state'],
      published: true,
      position: 0,
      template: 'react-ts',
      files: counterFiles,
    },
  });

  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.warn('ADMIN_EMAIL manquant : aucun admin promu');
  } else {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn(
        `Aucun compte pour ${email}. Inscris-toi sur /register puis relance : pnpm exec prisma db seed`,
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
  console.log('SEED OK : stack React / Thème Hooks / fiche useState');
}

const counterQuizQuestions = [
  {
    id: 'q-usestate-1',
    prompt: 'À quoi sert useState ?',
    choices: [
      'Garder une valeur entre les rendus',
      'Remplacer tous les composants',
      'Appeler l’API au montage',
    ],
    correctIndex: 0,
  },
  {
    id: 'q-usestate-2',
    prompt: 'Comment mets-tu à jour un compteur si la nouvelle valeur dépend de l’ancienne ?',
    choices: ['setCount(count + 1) uniquement', 'setCount((c) => c + 1)', 'count = count + 1'],
    correctIndex: 1,
  },
  {
    id: 'q-usestate-3',
    prompt: 'Que fait setCount ?',
    choices: [
      'Il change count sans re-render',
      'Il déclenche un re-render avec la nouvelle valeur',
      'Il supprime le composant',
    ],
    correctIndex: 1,
  },
];

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
