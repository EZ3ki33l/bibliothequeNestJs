import { IsBoolean } from 'class-validator';

/**
 * PATCH d'une étape : seul son caractère facultatif change. Changer de fiche
 * ou de module, c'est retirer l'étape puis en ajouter une autre.
 */
export class UpdatePathStepDto {
  @IsBoolean()
  optional!: boolean;
}
