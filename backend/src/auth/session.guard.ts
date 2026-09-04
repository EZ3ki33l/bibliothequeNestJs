import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getAuth } from './auth';

/**
 * Authentification : *qui es-tu ?*
 *
 * Un *guard* s'exécute avant le contrôleur et répond par oui/non. Celui-ci lit
 * le cookie de session, demande à better-auth de le valider, et refuse en 401
 * si la session est absente ou expirée.
 *
 * Il dépose ensuite la session sur la requête pour la suite de la chaîne :
 * `AdminGuard` la relit, et `@CurrentUserId()` en extrait l'utilisateur. La
 * session est donc résolue une seule fois par requête.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const auth = getAuth(this.prisma);

    // `fromNodeHeaders` convertit les en-têtes Node en `Headers` standard,
    // le format attendu par better-auth.
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException();
    }

    (request as Request & { session: typeof session }).session = session;
    return true;
  }
}
