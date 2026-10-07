import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { HOOK_ENTRIES, LEGACY_SOURCE_MARKER, demoSourceRows } from './demo-entries';

/**
 * Met à jour le texte et les sources des fiches de démonstration déjà en base.
 *
 *   pnpm db:demo-content
 *
 * À la différence de `pnpm db:seed`, cette commande est faite pour la
 * production. Elle ne crée aucune fiche, n'en publie aucune, ne touche ni au
 * parcours de démonstration ni aux comptes. Pour chaque fiche de démonstration
 * **présente**, elle remplace le résumé, le corps et la liste des sources.
 *
 * Elle ne convertit que les fiches dont le corps porte encore l'ancienne ligne
 * « Source : [react.dev … » : une fiche déjà convertie, ou réécrite à la main
 * depuis l'administration, est laissée telle quelle. La commande peut donc
 * être relancée sans risque : la seconde exécution ne convertit plus rien.
 *
 * Le titre n'est pas réécrit (le slug en dépend), pas plus que l'état de
 * publication, la position, les étiquettes ou les fichiers du playground.
 *
 * Le script agit sur la base désignée par `DATABASE_URL`. En production, il se
 * lance dans le conteneur de l'API, qui embarque la version compilée :
 *
 *   docker compose exec api node dist/prisma/update-demo-content.js
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  let converted = 0;

  for (const entry of HOOK_ENTRIES) {
    const existing = await prisma.entry.findUnique({
      where: { slug: entry.slug },
      select: { id: true, bodyMdx: true },
    });

    if (!existing) {
      console.log(`${entry.slug} : absente, ignorée`);
      continue;
    }

    if (!existing.bodyMdx.includes(LEGACY_SOURCE_MARKER)) {
      console.log(`${entry.slug} : déjà convertie ou modifiée, laissée telle quelle`);
      continue;
    }

    // Écriture imbriquée : le texte et les sources changent ensemble, dans une
    // seule transaction.
    await prisma.entry.update({
      where: { id: existing.id },
      data: {
        summary: entry.summary,
        bodyMdx: entry.bodyMdx,
        sources: { deleteMany: {}, create: demoSourceRows(entry.sources) },
      },
    });

    converted += 1;
    console.log(`${entry.slug} : convertie`);
  }

  console.log(`Fiches de démonstration converties : ${converted} / ${HOOK_ENTRIES.length}`);
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
