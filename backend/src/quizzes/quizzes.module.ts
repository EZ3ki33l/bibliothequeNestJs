import { Module } from '@nestjs/common';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { SessionGuard } from '../auth/session.guard';
import { QUIZ_GENERATOR } from './quiz-generator';
import { LlmQuizGenerator } from './llm-quiz-generator';

@Module({
  controllers: [QuizzesController],
  providers: [
    QuizzesService,
    SessionGuard,
    { provide: QUIZ_GENERATOR, useClass: LlmQuizGenerator },
  ],
})
export class QuizzesModule {}
