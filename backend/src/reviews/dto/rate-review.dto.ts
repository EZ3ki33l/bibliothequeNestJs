import { IsEnum } from 'class-validator';
import { ReviewRating } from '../../generated/prisma/enums';

/**
 * Contrat de `POST /reviews/:id/rate`.
 *
 * `@IsEnum` restreint la note aux quatre valeurs de l'énumération Prisma
 * (AGAIN, HARD, GOOD, EASY) : impossible d'envoyer une note inventée qui
 * ferait dérailler le calcul du calendrier.
 */
export class RateReviewDto {
  @IsEnum(ReviewRating)
  rating!: ReviewRating;
}
