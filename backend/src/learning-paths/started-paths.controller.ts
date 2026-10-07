import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { PathProgressService } from './path-progress.service';

/**
 * Parcours commencés par le compte connecté, pour l'accueil.
 *
 * Contrôleur séparé de `PathProgressController` : celui-ci a déjà
 * `GET progress/learning-paths/:slug`, qui capturerait un chemin voisin (un
 * parcours pourrait s'appeler « started »). Un préfixe distinct supprime la
 * collision au lieu de dépendre de l'ordre de déclaration des routes.
 *
 * Aucun paramètre : ni identifiant de compte (il vient de la session), ni
 * taille de page (la réponse est bornée à trois parcours par le service).
 */
@Controller('progress/started-paths')
@UseGuards(SessionGuard)
export class StartedPathsController {
  constructor(private readonly pathProgressService: PathProgressService) {}

  @Get()
  findStarted(@CurrentUserId() userId: string) {
    return this.pathProgressService.findStarted(userId);
  }
}
