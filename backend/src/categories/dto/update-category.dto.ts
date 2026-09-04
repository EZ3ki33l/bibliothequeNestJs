import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * PATCH d'une catégorie : tous les champs sont optionnels, mais **seuls**
 * ceux-ci sont acceptés.
 *
 * `stackId` est volontairement absent : déplacer une catégorie vers un autre
 * stack n'est pas un renommage (il faudrait recalculer les positions des deux
 * stacks). Et comme `ValidationPipe` tourne avec `forbidNonWhitelisted`, un
 * client qui tenterait de l'envoyer reçoit un 400 — pas un déplacement
 * silencieux.
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
