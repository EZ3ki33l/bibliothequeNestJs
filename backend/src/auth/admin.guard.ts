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
 * Il existe deux rôles (`ADMIN`, `SUPER_ADMIN`) : ce guard accepte les deux et
 * dépose le rôle sur la requête. Ce que chacun peut écrire est décidé plus
 * loin, dans les services (`common/editorial-rights.ts`), parce que la réponse
 * dépend du contenu visé (publié ou non), pas seulement de la route.
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

    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { role: true },
    });
    if (!admin) {
      throw new ForbiddenException();
    }

    request.adminRole = admin.role;

    return true;
  }
}
