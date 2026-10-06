import { Controller, Get, Param, Query } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PathSlugParamDto } from './dto/path-slug-param.dto';

/**
 * Lectures publiques des parcours : uniquement les parcours publiés, et dans
 * chacun uniquement les étapes dont la fiche est publiée.
 *
 * Aucune garde, et aucune donnée de compte dans les réponses : la progression
 * passe par `PathProgressController`, sous session. Mélanger les deux sur une
 * même route (session « facultative ») rendrait trop facile l'oubli du filtre
 * `userId`.
 */
@Controller('learning-paths')
export class LearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  @Get()
  findPublished(@Query() query: PaginationQueryDto) {
    return this.learningPathsService.findPublished(query.page, query.limit);
  }

  @Get(':slug')
  findPublishedBySlug(@Param() params: PathSlugParamDto) {
    return this.learningPathsService.findPublishedBySlug(params.slug);
  }
}
