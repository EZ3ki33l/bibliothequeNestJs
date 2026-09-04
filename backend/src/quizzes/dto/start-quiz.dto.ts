import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Contrat de `POST /quizzes/start`.
 *
 * La fiche est désignée par son slug public, celui de l'URL `/entries/:slug`.
 */
export class StartQuizDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
