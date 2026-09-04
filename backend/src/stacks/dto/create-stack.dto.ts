import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Contrat de `POST /admin/stacks`.
 *
 * Seuls `name` et `description` sont acceptés : `slug` et `position` sont
 * calculés par le service. Un client qui les enverrait quand même serait rejeté
 * en 400 par le `ValidationPipe` global (`forbidNonWhitelisted`).
 */
export class CreateStackDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
