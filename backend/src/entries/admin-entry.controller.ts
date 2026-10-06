import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentAdminRole } from '../auth/current-user.decorator';
import type { AdminRole } from '../generated/prisma/enums';
import { EntriesService } from './entries.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { AdminEntriesQueryDto } from './dto/admin-entries-query.dto';

/**
 * CRUD admin des fiches. Contrairement aux routes publiques d'`EntriesController`,
 * les lectures ici renvoient aussi les brouillons.
 */
@Controller('admin/entries')
@UseGuards(SessionGuard, AdminGuard)
export class AdminEntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get()
  findAll(@Query() query: AdminEntriesQueryDto) {
    return this.entriesService.findAllAdmin(query.page, query.limit, query.q);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.entriesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEntryDto, @CurrentAdminRole() role: AdminRole) {
    return this.entriesService.create(dto, role);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntryDto,
    @CurrentAdminRole() role: AdminRole,
  ) {
    return this.entriesService.update(id, dto, role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentAdminRole() role: AdminRole) {
    return this.entriesService.delete(id, role);
  }
}
