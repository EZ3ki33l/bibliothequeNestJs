import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** Une réponse : la question visée et l'index du choix retenu. */
export class QuizAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  choiceIndex!: number;
}

/**
 * Contrat de `POST /quizzes/:id/submit`.
 *
 * `@ValidateNested({ each: true })` **avec** `@Type(() => QuizAnswerDto)` :
 * les deux sont nécessaires. Sans `@Type`, chaque élément resterait un objet
 * brut et ses propres règles ne seraient jamais appliquées — le tableau
 * passerait la validation sans que son contenu soit vérifié.
 *
 * Cette validation ne contrôle que la *forme*. Que les réponses correspondent
 * bien aux questions enregistrées est vérifié par le service, qui compare avec
 * l'instantané stocké en base.
 */
export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];
}
