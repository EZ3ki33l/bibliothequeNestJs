import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from './session.guard';
import { AdminGuard } from './admin.guard';
import { CurrentUser } from './current-user.decorator';
import type { SessionUser } from './authed-request';

/**
 * Routes de vérification de session, utilisées par le frontend comme gardes de
 * navigation : la SPA appelle `/me` (ou `/admin/me`) et lit **le statut HTTP**
 * pour décider d'afficher la page ou de rediriger.
 *
 * Pourquoi côté serveur ? Parce qu'un état stocké dans le navigateur
 * (`useSession()`, localStorage) est modifiable par l'utilisateur. Le serveur
 * reste la seule autorité : 200 = autorisé, 401 = pas de session, 403 = session
 * valide mais droits insuffisants.
 */
@Controller()
export class MeController {
  /** 200 si la session est valide, 401 sinon (levé par `SessionGuard`). */
  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  /**
   * 200 si la session appartient à un admin.
   *
   * L'ordre des guards compte : `SessionGuard` authentifie (*qui es-tu ?*) et
   * dépose la session sur la requête, puis `AdminGuard` autorise (*as-tu le
   * droit ?*) en la relisant. Inversés, `AdminGuard` ne trouverait pas de
   * session et renverrait 401 au lieu de 403.
   */
  @Get('admin/me')
  @UseGuards(SessionGuard, AdminGuard)
  adminMe(@CurrentUser() user: SessionUser) {
    return user;
  }
}
