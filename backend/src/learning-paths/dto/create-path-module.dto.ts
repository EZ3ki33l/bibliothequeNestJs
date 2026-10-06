import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from './trim';

/**
 * Contrat de `POST /admin/learning-paths/:id/modules`.
 *
 * Le parcours parent vient de l'URL, la position est calculée (fin de liste) :
 * aucun des deux n'est accepté dans le body.
 */
export class CreatePathModuleDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
