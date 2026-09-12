import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { FavoritesService } from './favorites.service';
import { ListFavoritesQueryDto } from './dto/list-favorites-query.dto';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import type { Response } from 'express';

/**
 * Favoris : action d'un utilisateur connecté sur son propre compte, pas une
 * fonctionnalité admin — `SessionGuard` suffit, pas d'`AdminGuard`.
 */
@Controller('favorites')
@UseGuards(SessionGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  /** Favoris du compte connecté, jamais un `userId` venu de la query. */
  @Get()
  findMany(@Query() dto: ListFavoritesQueryDto, @CurrentUserId() userId: string) {
    return this.favoritesService.findMany(userId, dto);
  }

  @Post()
  async create(
    @Body() dto: CreateFavoriteDto,
    @CurrentUserId() userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, ...favorite } = await this.favoritesService.create(userId, dto.entryId);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return favorite;
  }

  /**
   * Retire un favori. Toujours `204` (déjà absent ou appartenant à un autre
   * compte = no-op silencieux), jamais `403` : révéler qu'un favori
   * appartient à quelqu'un d'autre serait une fuite d'information (IDOR).
   */
  @Delete(':entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    return this.favoritesService.remove(userId, entryId);
  }
}
