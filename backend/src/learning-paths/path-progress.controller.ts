import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PathSlugParamDto } from './dto/path-slug-param.dto';
import { PathProgressService } from './path-progress.service';

/**
 * Progression du compte connecté. `SessionGuard` suffit (pas d'`AdminGuard`) :
 * chacun lit **sa** progression, et aucune route n'accepte d'identifiant de
 * compte, ce qui ferme la porte à la lecture de la progression d'autrui.
 *
 * Préfixe `progress/` plutôt que `learning-paths/progress` : ce dernier serait
 * capturé par `GET /learning-paths/:slug` du contrôleur public.
 */
@Controller('progress/learning-paths')
@UseGuards(SessionGuard)
export class PathProgressController {
  constructor(private readonly pathProgressService: PathProgressService) {}

  @Get()
  findPage(@Query() query: PaginationQueryDto, @CurrentUserId() userId: string) {
    return this.pathProgressService.findPage(userId, query.page, query.limit);
  }

  @Get(':slug')
  findForPath(@Param() params: PathSlugParamDto, @CurrentUserId() userId: string) {
    return this.pathProgressService.findForPath(userId, params.slug);
  }
}
