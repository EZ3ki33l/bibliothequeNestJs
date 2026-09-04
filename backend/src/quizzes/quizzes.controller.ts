import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { QuizzesService } from './quizzes.service';
import { StartQuizDto } from './dto/start-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

/**
 * Examen d'une fiche : QCM généré par un modèle de langage, puis corrigé.
 *
 * Les deux routes sont des `POST` alors que « démarrer » ressemble à une
 * lecture : c'est bien une écriture, car elle crée (ou reprend) une tentative
 * en base. Le `@HttpCode(OK)` remplace le 201 par défaut de Nest sur `POST`,
 * car la réponse décrit un état de travail, pas une ressource nouvellement
 * créée à une URL.
 */
@Controller('quizzes')
@UseGuards(SessionGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  /** Reprend la tentative en cours, ou en génère une nouvelle. */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartQuizDto, @CurrentUserId() userId: string) {
    return this.quizzesService.start(userId, dto.slug);
  }

  /** Corrige les réponses et renvoie le score + le récapitulatif. */
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUserId() userId: string,
  ) {
    return this.quizzesService.submit(userId, id, dto.answers);
  }
}
