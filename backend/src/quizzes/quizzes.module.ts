import { Module } from '@nestjs/common';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { SessionGuard } from '../auth/session.guard';
import { QUIZ_GENERATOR } from './quiz-generator';
import { LlmQuizGenerator } from './llm-quiz-generator';

/**
 * Frontière du domaine « examens ».
 *
 * `{ provide: QUIZ_GENERATOR, useClass: LlmQuizGenerator }` associe un jeton
 * (`QUIZ_GENERATOR`) à une implémentation. `QuizzesService` demande le jeton,
 * pas la classe : il ne sait donc pas qu'un modèle de langage est derrière, et
 * les tests fournissent un faux générateur en remplaçant cette seule ligne.
 *
 * Un jeton est nécessaire parce que `QuizGenerator` est une *interface* :
 * elle disparaît à la compilation, Nest n'a donc rien à injecter sans lui.
 */
@Module({
  controllers: [QuizzesController],
  providers: [
    QuizzesService,
    SessionGuard,
    { provide: QUIZ_GENERATOR, useClass: LlmQuizGenerator },
  ],
})
export class QuizzesModule {}
