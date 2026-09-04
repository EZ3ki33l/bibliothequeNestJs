import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Configuration de l'authentification.
 *
 * Les secrets viennent de l'environnement et ne sont jamais écrits en dur ni
 * journalisés : `BETTER_AUTH_SECRET` signe les cookies de session, le divulguer
 * reviendrait à laisser fabriquer des sessions.
 *
 * `trustedOrigins` limite les origines autorisées à parler à l'API d'auth ;
 * avec des cookies de session, accepter « toutes les origines » ouvrirait la
 * porte au CSRF.
 */
function createAuth(prisma: PrismaClient) {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: { enabled: true },
    session: {
      // Pas de cache de session dans un cookie : la révocation (déconnexion,
      // perte de droits) doit être immédiate, donc on relit la base.
      cookieCache: { enabled: false },
    },
  });
}

/** Le type exact est inféré : l'annoter à la main perd la précision des options. */
type Auth = ReturnType<typeof createAuth>;

let auth: Auth | null = null;

/**
 * Renvoie l'instance d'authentification, construite au premier appel.
 *
 * `betterAuth()` assemble l'adaptateur de base, les routes et la gestion des
 * cookies : c'est un objet à créer une fois au démarrage, pas à chaque requête.
 * Le mettre en cache ici évite de le reconstruire à chaque passage dans
 * `SessionGuard`, c'est-à-dire à chaque requête authentifiée.
 */
export function getAuth(prisma: PrismaClient): Auth {
  if (!auth) {
    auth = createAuth(prisma);
  }

  return auth;
}
