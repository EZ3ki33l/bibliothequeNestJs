import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from './trim';

/**
 * PATCH d'un module. `pathId` est volontairement absent : un module ne change
 * pas de parcours (même règle que les catégories et les fiches).
 */
export class UpdatePathModuleDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
