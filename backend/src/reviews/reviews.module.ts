import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SessionGuard } from '../auth/session.guard';

/**
 * Frontière du domaine « révisions ».
 *
 * Pas d'`AdminGuard` dans ce module : réviser est une action d'utilisateur
 * connecté, la session suffit.
 */
@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, SessionGuard],
})
export class ReviewsModule {}
