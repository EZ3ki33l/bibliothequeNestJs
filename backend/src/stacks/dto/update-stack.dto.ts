import { IsOptional, IsString, MinLength } from 'class-validator';

/** Contrat de `PATCH /admin/stacks/:id` : tout est optionnel (mise à jour partielle). */
export class UpdateStackDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
