import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, SessionGuard],
})
export class ReviewsModule {}
