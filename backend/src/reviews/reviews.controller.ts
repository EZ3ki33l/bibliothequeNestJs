import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { RateReviewDto } from './dto/rate-review.dto';
import { EnsureReviewDto } from './dto/ensure-review.dto';

/**
 * Révision espacée : les cartes appartiennent à l'utilisateur connecté.
 *
 * `SessionGuard` suffit ici — pas d'`AdminGuard` : réviser est une action
 * d'utilisateur, pas d'administrateur. Toutes les méthodes reçoivent l'`userId`
 * de la session via `@CurrentUserId()`, jamais un id venu de l'URL ou du corps.
 * C'est ce qui empêche de lire ou noter les cartes de quelqu'un d'autre (IDOR).
 */
@Controller('reviews')
@UseGuards(SessionGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Carte à réviser maintenant + nombre de cartes restantes. */
  @Get('due')
  findDue(@CurrentUserId() userId: string) {
    return this.reviewsService.findDue(userId);
  }

  /**
   * Inscrit une fiche au programme de révision (appelé à l'ouverture d'une
   * fiche). Idempotent : rappeler la route ne réinitialise pas le calendrier,
   * d'où le 204 sans corps.
   */
  @Post('ensure')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ensure(@Body() dto: EnsureReviewDto, @CurrentUserId() userId: string) {
    await this.reviewsService.ensure(userId, dto.entryId);
  }

  /** Note une carte (AGAIN / HARD / GOOD / EASY) et renvoie la suivante. */
  @Post(':id/rate')
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateReviewDto,
    @CurrentUserId() userId: string,
  ) {
    return this.reviewsService.rate(userId, id, dto.rating);
  }
}
