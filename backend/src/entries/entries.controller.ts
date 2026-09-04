import { Controller, Get, Param } from '@nestjs/common';
import { EntriesService } from './entries.service';

/**
 * Lectures publiques des fiches : uniquement les fiches publiées.
 *
 * Le slug est unique dans tout le catalogue, l'URL n'a donc pas besoin du stack
 * ni de la catégorie : `/entries/use-state`.
 */
@Controller('entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get()
  findPublished() {
    return this.entriesService.findPublished();
  }

  @Get(':slug')
  findPublishedBySlug(@Param('slug') slug: string) {
    return this.entriesService.findPublishedBySlug(slug);
  }
}
