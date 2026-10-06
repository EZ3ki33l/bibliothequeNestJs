import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, AdminRole } from '../src/generated/prisma/client';

/**
 * Attribue ou retire un rôle d'administration à un compte existant.
 *
 *   pnpm admin:role <email> <ADMIN|SUPER_ADMIN|NONE>
 *
 * - `ADMIN` : rédacteur, brouillons uniquement (voir `common/editorial-rights.ts`).
 * - `SUPER_ADMIN` : tous les droits, publication comprise.
 * - `NONE` : retire les droits ; le compte redevient un compte ordinaire.
 *
 * Le rôle est un argument et non une variable d'environnement : c'est un geste
 * ponctuel et volontaire, fait par quelqu'un qui a déjà accès à la base. Le
 * compte doit exister (inscription sur `/register` d'abord) ; ce script ne crée
 * aucun utilisateur et ne touche à aucun mot de passe.
 *
 * Le script agit sur la base désignée par `DATABASE_URL`. En production, il se
 * lance dans le conteneur de l'API, qui embarque la version compilée :
 *
 *   docker compose exec api node dist/prisma/set-admin-role.js <email> <rôle>
 */

const REVOKE = 'NONE';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function isAdminRole(value: string): value is AdminRole {
  return Object.values<string>(AdminRole).includes(value);
}

async function main() {
  const [email, role] = process.argv.slice(2);

  if (!email || !role || (role !== REVOKE && !isAdminRole(role))) {
    throw new Error('Usage : pnpm admin:role <email> <ADMIN|SUPER_ADMIN|NONE>');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, admin: { select: { role: true } } },
  });
  if (!user) {
    throw new Error(`Aucun compte pour ${email} : l'inscription doit précéder l'attribution`);
  }

  // Sans ce garde-fou, rétrograder le dernier super administrateur laisserait
  // le site sans personne pour publier ni pour redonner ce rôle depuis l'API.
  if (user.admin?.role === AdminRole.SUPER_ADMIN && role !== AdminRole.SUPER_ADMIN) {
    const superAdmins = await prisma.admin.count({ where: { role: AdminRole.SUPER_ADMIN } });
    if (superAdmins <= 1) {
      throw new Error('Refusé : ce compte est le dernier SUPER_ADMIN');
    }
  }

  if (role === REVOKE) {
    await prisma.admin.deleteMany({ where: { userId: user.id } });
    console.log(`${email} : droits d'administration retirés`);
    return;
  }

  await prisma.admin.upsert({
    where: { userId: user.id },
    update: { role },
    create: { userId: user.id, role },
  });
  console.log(`${email} : ${role}`);
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
