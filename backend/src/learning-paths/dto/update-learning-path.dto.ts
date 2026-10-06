import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from './trim';

/**
 * PATCH d'un parcours : renommer, décrire, publier ou dépublier.
 *
 * Renommer recalcule le slug côté serveur ; `slug` et `position` restent
 * refusés en entrée.
 */
export class UpdateLearningPathDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
