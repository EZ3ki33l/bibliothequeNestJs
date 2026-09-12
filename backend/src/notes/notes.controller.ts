import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { ListNotesQueryDto } from './dto/list-notes-query.dto';
import { UpsertNoteDto } from './dto/upsert-note.dto';
import { NotesService } from './notes.service';

@Controller('notes')
@UseGuards(SessionGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findMany(@Query() dto: ListNotesQueryDto, @CurrentUserId() userId: string) {
    return this.notesService.findMany(userId, dto);
  }

  @Put(':entryId')
  async save(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: UpsertNoteDto,
    @CurrentUserId() userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.notesService.save(userId, entryId, dto.content);

    if (result === null) {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }

    const { created, ...note } = result;
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return note;
  }

  @Delete(':entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    return this.notesService.remove(userId, entryId);
  }
}
