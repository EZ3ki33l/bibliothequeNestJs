import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';
import { EntriesService } from './entries.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

@Controller('admin/entries')
@UseGuards(SessionGuard, AdminGuard)
export class AdminEntriesController {
  constructor(private readonly entriesService: EntriesService) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEntryDto) {
    return this.entriesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntryDto) {
    return this.entriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.entriesService.delete(id);
  }
}
