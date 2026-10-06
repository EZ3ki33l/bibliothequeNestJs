import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** Nouvel ordre **complet** des étapes d'un module (même règle que `ReorderModulesDto`). */
export class ReorderStepsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  stepIds!: string[];
}
