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
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionUser } from '../auth/authed-request';
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
 *
 * `@CurrentUser()` et non `@CurrentUserId()` : le service a besoin de savoir si
 * l'adresse du compte est vérifiée, pour refuser l'examen d'une fiche que ce
 * compte ne peut pas lire. Cette information vient de la session, jamais du
 * corps de la requête.
 */
@Controller('quizzes')
@UseGuards(SessionGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  /** Reprend la tentative en cours, ou en génère une nouvelle. */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartQuizDto, @CurrentUser() user: SessionUser) {
    return this.quizzesService.start(user, dto.slug);
  }

  /** Corrige les réponses et renvoie le score + le récapitulatif. */
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.quizzesService.submit(user, id, dto.answers);
  }
}
