import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { VERIFIED_EMAIL_REQUIRED } from '../common/free-access';
import type { AuthedRequest } from './authed-request';

/**
 * Autorisation : *l'adresse de ce compte est-elle vérifiée ?*
 *
 * Un *guard* est une classe que Nest exécute **avant** le contrôleur et qui
 * répond oui ou non. Deux questions se posent dans l'ordre, et chacune a son
 * guard :
 *
 * 1. `SessionGuard` : *qui est-ce ?* (authentification) → 401 sans session ;
 * 2. `VerifiedEmailGuard` : *a-t-il le droit ?* (autorisation) → 403 si
 *    l'adresse du compte n'est pas vérifiée.
 *
 * S'utilise donc **après** `SessionGuard`, jamais seul :
 * `@UseGuards(SessionGuard, VerifiedEmailGuard)`. Nest exécute les guards dans
 * l'ordre de la liste, et celui-ci relit l'utilisateur que le premier a déposé
 * sur la requête. C'est le même enchaînement que pour `AdminGuard`. Inversés,
 * ce guard ne trouverait aucun utilisateur et répondrait 401 à tout le monde.
 *
 * Aucune requête en base ici : `SessionGuard` vient de relire le compte
 * (`cookieCache` est désactivé), `emailVerified` est donc à jour. Une adresse
 * vérifiée à l'instant ouvre l'accès dès la requête suivante.
 *
 * Deux refus différents, comme `AdminGuard` : le navigateur choisit entre
 * « se connecter » (401) et « vérifier l'adresse » (403).
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = request.session?.user;

    // Guard placé seul par erreur, sans `SessionGuard` devant : refus, jamais
    // passage. Un oubli de câblage ne doit pas ouvrir la route.
    if (!user?.id) {
      throw new UnauthorizedException();
    }

    // `!== true` : un champ absent, `null` ou la chaîne `'true'` ne valent pas
    // « vérifié ». Seul le booléen lu en base ouvre la route.
    if (user.emailVerified !== true) {
      throw new ForbiddenException(VERIFIED_EMAIL_REQUIRED);
    }

    return true;
  }
}
