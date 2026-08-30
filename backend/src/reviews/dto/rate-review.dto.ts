import { IsEnum } from 'class-validator';
import { ReviewRating } from '../../generated/prisma/enums';

export class RateReviewDto {
  @IsEnum(ReviewRating)
  rating!: ReviewRating;
}
