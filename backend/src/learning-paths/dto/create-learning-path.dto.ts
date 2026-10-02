import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from './trim';

/**
 * Contrat de `POST /admin/learning-paths`.
 *
 * Ni `slug`, ni `position`, ni `published` : le slug et la position sont
 * calculés par le serveur, et un parcours naît toujours brouillon. Un client
 * qui les enverrait reçoit un 400 (`forbidNonWhitelisted`).
 */
export class CreateLearningPathDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
