import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { expo } from '@better-auth/expo';
import { PrismaClient } from '../generated/prisma/client';
import { deletionRefusal, isPasswordProvided } from '../common/account-deletion';
import {
  isValidDisplayName,
  mustRevokeOtherSessions,
  profileUpdateRefusal,
} from '../common/account-profile';
import { verificationRequestRefusal } from '../common/email-verification-rules';
import { isResetMailConfigured, sendPasswordResetEmail } from './password-reset-mailer';
import { isVerificationMailConfigured, sendVerificationEmail } from './verification-mailer';
import { frontendOrigins } from '../common/frontend-origins';

const INVALID_NAME_MESSAGE = 'Le nom doit contenir entre 2 et 80 caractères';

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
    // Vérification de l'adresse : un lien signé, valable une heure, envoyé par
    // message. `emailAndPassword.requireEmailVerification` reste **absent**,
    // exprès : un compte non vérifié se connecte et utilise le site ; seule la
    // lecture des fiches réservées lui est fermée (`VerifiedEmailGuard`).
    emailVerification: {
      expiresIn: 3600,
      // Le message ne part pas pendant l'inscription : better-auth l'enverrait
      // en tâche de fond, et l'écran ne saurait pas s'il est arrivé. Le
      // navigateur le demande juste après, par la même route que le renvoi :
      // un seul chemin d'envoi, dont le résultat se lit.
      sendOnSignUp: false,
      // Le lien ne pose aucun cookie : transmis à un tiers, il ne fait que
      // vérifier l'adresse et n'ouvre ni session ni donnée du compte.
      autoSignInAfterVerification: false,
      // **Attendu**, à l'inverse de `sendResetPassword` : la demande est sous
      // session et ne vise que l'adresse du compte connecté (voir le hook
      // `before`), donc sa durée ne renseigne sur aucun autre compte. Attendre
      // permet de répondre 503 quand rien n'est parti, au lieu d'un faux succès.
      sendVerificationEmail: async ({ user, url }) => {
        if (!(await sendVerificationEmail(user.email, url))) {
          throw new APIError('SERVICE_UNAVAILABLE', {
            message: 'Le message de vérification n’a pas pu être envoyé',
          });
        }
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
      // (sessions, comptes, lectures, favoris, notes, quiz) partent avec elle
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
      before: createAuthMiddleware(async (ctx) => {
        // Un message de vérification ne se demande que **sous session**. Sans
        // cette règle, better-auth écrirait à toute adresse inscrite et non
        // vérifiée qu'un inconnu lui donnerait (inondation d'une boîte, quota
        // d'envoi épuisé). Avec une session, il exige lui-même que l'adresse
        // soit celle du compte : la demande ne peut viser que sa propre boîte.
        if (ctx.path === '/send-verification-email') {
          const session = await getSessionFromCtx(ctx);
          const refusal = verificationRequestRefusal({
            hasSession: session !== null,
            mailerConfigured: isVerificationMailConfigured(),
          });

          if (refusal === 'SESSION_REQUIRED') {
            throw new APIError('UNAUTHORIZED', {
              message: 'Une session est requise pour demander un message de vérification',
            });
          }
          if (refusal === 'MAILER_UNAVAILABLE') {
            throw new APIError('SERVICE_UNAVAILABLE', {
              message: 'L’envoi du message de vérification est momentanément indisponible',
            });
          }
        }

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

        // Les trois règles qui suivent durcissent des routes que better-auth
        // expose déjà (voir `common/account-profile.ts`). Elles vivent ici, et
        // pas seulement dans le formulaire : une requête forgée ne passe pas
        // par le formulaire.
        const body: unknown = ctx.body;

        // Nom affiché : mêmes bornes à l'inscription et à la modification.
        if (ctx.path === '/sign-up/email') {
          const name =
            typeof body === 'object' && body !== null
              ? (body as { name?: unknown }).name
              : undefined;

          if (!isValidDisplayName(name)) {
            throw new APIError('BAD_REQUEST', { message: INVALID_NAME_MESSAGE });
          }
        }

        // Profil : seul le nom se modifie. `image`, ou tout autre champ, est
        // refusé plutôt qu'ignoré (liste blanche, contre le mass assignment).
        if (ctx.path === '/update-user') {
          const refusal = profileUpdateRefusal(body);

          if (refusal === 'UNKNOWN_FIELD') {
            throw new APIError('BAD_REQUEST', {
              message: 'Seul le nom affiché peut être modifié',
            });
          }
          if (refusal === 'INVALID_NAME') {
            throw new APIError('BAD_REQUEST', { message: INVALID_NAME_MESSAGE });
          }
        }

        // Changer de mot de passe ferme les autres sessions : si le compte
        // était compromis, l'intrus ne reste pas connecté. better-auth vérifie
        // ensuite lui-même le mot de passe actuel et la longueur du nouveau.
        if (ctx.path === '/change-password' && !mustRevokeOtherSessions(body)) {
          throw new APIError('BAD_REQUEST', {
            message: 'Le changement de mot de passe doit fermer les autres sessions',
          });
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
