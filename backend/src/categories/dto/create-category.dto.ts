import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** Contrat de `POST /admin/categories`. */
export class CreateCategoryDto {
  /**
   * Stack parent. `@IsUUID()` refuse les identifiants mal formés avant toute
   * requête en base ; le service vérifie ensuite que ce stack existe (404).
   */
  @IsUUID()
  stackId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
