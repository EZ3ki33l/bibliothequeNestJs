import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthedRequest } from './authed-request';

/**
 * Autorisation : *as-tu le droit ?*
 *
 * À distinguer de `SessionGuard`, qui ne fait qu'authentifier. Être connecté ne
 * rend pas administrateur : le rôle est vérifié en base (table `Admin`), pas
 * déduit d'un champ envoyé par le client ni d'un email codé en dur.
 *
 * S'utilise **après** `SessionGuard` : `@UseGuards(SessionGuard, AdminGuard)`.
 * Les guards s'exécutent dans cet ordre, et celui-ci a besoin de la session que
 * le premier a déposée.
 *
 * Deux refus différents, volontairement : 401 « je ne sais pas qui tu es »,
 * 403 « je sais qui tu es, et ce n'est pas permis ». Le frontend s'en sert pour
 * choisir entre rediriger vers la connexion et afficher un refus.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    const userId = request.session?.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const admin = await this.prisma.admin.findUnique({ where: { userId } });
    if (!admin) {
      throw new ForbiddenException();
    }

    return true;
  }
}
