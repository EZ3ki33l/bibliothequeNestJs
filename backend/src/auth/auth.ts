import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { expo } from '@better-auth/expo';
import { PrismaClient } from '../generated/prisma/client';
import { deletionRefusal, isPasswordProvided } from '../common/account-deletion';
import { isResetMailConfigured, sendPasswordResetEmail } from './password-reset-mailer';
import { frontendOrigins } from '../common/frontend-origins';

/**
 * Configuration de l'authentification.
 *
 * Les secrets viennent de l'environnement et ne sont jamais écrits en dur ni
 * journalisés : `BETTER_AUTH_SECRET` signe les cookies de session, le divulguer
 * reviendrait à laisser fabriquer des sessions.
 *
 * `trustedOrigins` limite les origines autorisées à parler à l'API d'auth ;
 * avec des cookies de session, accepter « toutes les origines » ouvrirait la
 * porte au CSRF. Le scheme `MOBILE_APP_SCHEME` (ex. `bibliotheque://`) couvre
 * l'app Expo ; les patterns `exp://` ne sont acceptés qu'en dev, jamais en prod.
 *
 * Le plugin `expo()` adapte better-auth au client React Native : celui-ci n'a
 * pas de cookie-jar de navigateur, donc le client stocke le cookie de session
 * dans SecureStore et le renvoie lui-même à chaque requête.
 */
function createAuth(prisma: PrismaClient) {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      ...frontendOrigins(),
      process.env.MOBILE_APP_SCHEME ?? 'bibliotheque://',
      ...(process.env.NODE_ENV === 'production'
        ? []
        : ['exp://', 'exp://**', 'exp://192.168.*.*:*/**']),
    ],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      // Un mot de passe réinitialisé coupe toutes les sessions ouvertes : si le
      // compte était compromis, l'intrus ne garde pas son accès.
      revokeSessionsOnPasswordReset: true,
      // Volontairement **non attendu** : better-auth répond « si ce compte
      // existe, un courriel est parti » dans les deux cas. Attendre l'envoi
      // rendrait la réponse plus lente pour un compte existant, ce qui
      // révélerait quelles adresses ont un compte.
      sendResetPassword: ({ user, url }) => {
        void sendPasswordResetEmail(user.email, url);
        return Promise.resolve();
      },
    },
    session: {
      // Pas de cache de session dans un cookie : la révocation (déconnexion,
      // perte de droits) doit être immédiate, donc on relit la base.
      cookieCache: { enabled: false },
    },
    user: {
      // Suppression de compte en libre-service (`POST /api/auth/delete-user`).
      // better-auth efface la ligne `user` ; toutes les données de l'apprenant
      // (sessions, comptes, révisions, favoris, notes, quiz) partent avec elle
      // par les `onDelete: Cascade` du schéma Prisma.
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          const admin = await prisma.admin.findUnique({ where: { userId: user.id } });

          if (deletionRefusal(admin !== null)) {
            throw new APIError('FORBIDDEN', {
              message: 'Un compte administrateur ne peut pas être supprimé ici',
            });
          }
        },
      },
    },
    hooks: {
      // Les hooks tournent avant l'endpoint : en cas de refus, rien n'est créé
      // ni supprimé.
      // `async` sans `await` : better-auth exige une fonction qui renvoie une promesse.
      // eslint-disable-next-line @typescript-eslint/require-await
      before: createAuthMiddleware(async (ctx) => {
        // Sans expéditeur configuré, la demande échoue franchement (503) au lieu
        // de répondre « courriel envoyé » à quelqu'un qui n'en recevra jamais.
        // Le refus ne dépend pas de l'adresse saisie : il ne révèle aucun compte.
        if (ctx.path === '/request-password-reset' && !isResetMailConfigured()) {
          throw new APIError('SERVICE_UNAVAILABLE', {
            message: 'La réinitialisation du mot de passe est momentanément indisponible',
          });
        }

        // Le mot de passe est exigé pour supprimer : voir `isPasswordProvided`.
        if (ctx.path === '/delete-user') {
          const body: unknown = ctx.body;
          const password =
            typeof body === 'object' && body !== null
              ? (body as { password?: unknown }).password
              : undefined;

          if (!isPasswordProvided(password)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Le mot de passe est requis pour supprimer le compte',
            });
          }
        }
      }),
    },
    plugins: [expo()],
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
