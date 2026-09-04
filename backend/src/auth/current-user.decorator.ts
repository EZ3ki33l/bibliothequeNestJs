import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthedRequest, SessionUser } from './authed-request';

/**
 * Décorateurs de paramètre pour lire la session dans un contrôleur.
 *
 * Un « décorateur de paramètre » est une fonction que Nest appelle avant le
 * handler pour fabriquer un argument — exactement comme `@Body()` ou
 * `@Param()`, qui sont écrits de la même façon dans le framework.
 *
 * Pourquoi ne pas lire `request.session` directement ? Parce que chaque route
 * devait alors répéter :
 *
 * ```ts
 * const userId = request.session?.user.id;
 * if (!userId) throw new UnauthorizedException();
 * ```
 *
 * Cinq copies d'un contrôle de sécurité, c'est cinq occasions de l'oublier dans
 * la prochaine route. Ici le refus (fail closed) est garanti par construction :
 * un handler qui demande `@CurrentUserId()` ne peut pas s'exécuter sans session.
 */
function readSessionUser(context: ExecutionContext): SessionUser {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  const user = request.session?.user;

  // Ne devrait pas arriver : `SessionGuard` a déjà renvoyé 401. C'est un filet
  // de sécurité si un jour une route utilise ce décorateur sans le guard.
  if (!user?.id) {
    throw new UnauthorizedException();
  }

  return user;
}

/** Utilisateur de la session courante. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  readSessionUser(context),
);

/**
 * Identifiant de l'utilisateur courant.
 *
 * À passer aux services : c'est cet `userId` — jamais un id envoyé par le
 * client — qui filtre les lectures et écritures. Sans ça, un utilisateur
 * pourrait noter les révisions d'un autre (faille IDOR).
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => readSessionUser(context).id,
);
