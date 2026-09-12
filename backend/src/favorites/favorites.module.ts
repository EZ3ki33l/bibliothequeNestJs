import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { SessionGuard } from '../auth/session.guard';

/**
 * Frontière du domaine « favoris ».
 *
 * Pas d'`AdminGuard` dans ce module : mettre une fiche de côté est une action
 * d'utilisateur connecté, la session suffit.
 */
@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService, SessionGuard],
})
export class FavoritesModule {}
