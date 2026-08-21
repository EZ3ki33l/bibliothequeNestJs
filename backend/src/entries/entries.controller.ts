import { Controller, Get, Param } from '@nestjs/common';
import { EntriesService } from './entries.service';

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
