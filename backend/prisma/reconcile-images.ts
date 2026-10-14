import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { orphanKeys } from '../src/common/image-limits';
import { PrismaClient } from '../src/generated/prisma/client';
import { UploadThingImageStorage } from '../src/entry-images/uploadthing-image-storage';

/**
 * Rapproche les fichiers du prestataire de stockage et les images en base
 * (spec 016, research § 9).
 *
 *   pnpm images:reconcile            affiche, ne modifie rien
 *   pnpm images:reconcile --apply    retire en plus les fichiers orphelins
 *
 * Un fichier **orphelin** est chez le prestataire sans qu'aucune image en base
 * ne le désigne : reste d'un retrait qui a échoué (prestataire injoignable au
 * moment de supprimer une image ou une fiche). Il ne sert plus à rien mais
 * compte dans le quota de 2 Go.
 *
 * Le script signale aussi l'inverse — une image en base dont un fichier manque
 * chez le prestataire — sans rien modifier : c'est une décision humaine
 * (renvoyer l'image, ou la retirer de la fiche).
 *
 * En production, dans le conteneur de l'API :
 *
 *   docker compose exec api node dist/prisma/reconcile-images.js [--apply]
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const storage = new UploadThingImageStorage(new ConfigService());

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

async function main() {
  const apply = process.argv.includes('--apply');

  const images = await prisma.entryImage.findMany({ select: { readingKey: true, fullKey: true } });
  const known = new Set(images.flatMap((image) => [image.readingKey, image.fullKey]));

  const remote = new Map<string, number>();
  for await (const file of storage.list()) {
    remote.set(file.key, file.size);
  }

  const orphans = orphanKeys([...remote.keys()], known);
  const orphanBytes = orphans.reduce((total, key) => total + (remote.get(key) ?? 0), 0);
  const missing = [...known].filter((key) => !remote.has(key));

  console.log(`Fichiers chez le prestataire : ${remote.size}`);
  console.log(`Images en base : ${images.length} (${known.size} fichiers attendus)`);
  console.log(`Orphelins : ${orphans.length} (${megabytes(orphanBytes)})`);
  for (const key of orphans) console.log(`  orphelin  ${key}`);
  console.log(`Fichiers manquants chez le prestataire : ${missing.length}`);
  for (const key of missing) console.log(`  manquant  ${key}`);

  if (orphans.length === 0) {
    return;
  }

  if (!apply) {
    console.log('Rien n’est retiré sans --apply.');
    return;
  }

  const removed = await storage.remove(orphans);
  console.log(removed ? 'Orphelins retirés.' : 'Échec du retrait : relancer plus tard.');
  if (!removed) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
