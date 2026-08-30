import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { ReviewsService } from './reviews.service';
import { RateReviewDto } from './dto/rate-review.dto';
import { EnsureReviewDto } from './dto/ensure-review.dto';

type AuthedRequest = Request & { session?: { user: { id: string } } };

@Controller('reviews')
@UseGuards(SessionGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('due')
  findDue(@Req() request: AuthedRequest) {
    const userId = request.session?.user.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.reviewsService.findDue(userId);
  }

  @Post('ensure')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ensure(@Body() dto: EnsureReviewDto, @Req() request: AuthedRequest) {
    const userId = request.session?.user.id;

    if (!userId) {
      throw new UnauthorizedException();
    }
    await this.reviewsService.ensure(userId, dto.entryId);
  }

  @Post(':id/rate')
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateReviewDto,
    @Req() request: AuthedRequest,
  ) {
    const userId = request.session?.user.id;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return this.reviewsService.rate(userId, id, dto.rating);
  }
}
