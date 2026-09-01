import {
  Body,
  Controller,
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
import { QuizzesService } from './quizzes.service';
import { StartQuizDto } from './dto/start-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

type AuthedRequest = Request & { session?: { user: { id: string } } };

@Controller('quizzes')
@UseGuards(SessionGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartQuizDto, @Req() request: AuthedRequest) {
    const userId = request.session?.user.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.quizzesService.start(userId, dto.slug);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitQuizDto,
    @Req() request: AuthedRequest,
  ) {
    const userId = request.session?.user.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.quizzesService.submit(userId, id, dto.answers);
  }
}
