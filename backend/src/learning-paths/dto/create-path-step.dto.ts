import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * Contrat de `POST /admin/learning-paths/:id/modules/:moduleId/steps`.
 *
 * Seule la fiche est choisie : le module et le parcours viennent de l'URL, la
 * position est calculée. Une fiche brouillon est acceptée (elle reste masquée
 * côté public tant qu'elle n'est pas publiée).
 */
export class CreatePathStepDto {
  @IsUUID()
  entryId!: string;

  @IsOptional()
  @IsBoolean()
  optional?: boolean;
}
