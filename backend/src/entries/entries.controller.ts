import { Controller, Get, Param, Query } from '@nestjs/common';
import { EntriesService } from './entries.service';
import { SearchEntriesQueryDto } from './dto/search-entries-query.dto';

/**
 * Lectures publiques des fiches : uniquement les fiches publiées.
 *
 * Le slug est unique dans tout le catalogue, l'URL n'a donc pas besoin du stack
 * ni de la catégorie : `/entries/use-state`.
 *
 * `GET /entries` (liste) est déclaré **avant** `GET /entries/:slug` : Nest
 * matche dans l'ordre. Inversé, le mot `recherche` serait lu comme un slug.
 */
@Controller('entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get()
  findPublished(@Query() dto: SearchEntriesQueryDto) {
    return this.entriesService.findPublished(dto);
  }

  @Get(':slug')
  findPublishedBySlug(@Param('slug') slug: string) {
    return this.entriesService.findPublishedBySlug(slug);
  }
}
