import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Difficulty, EntryKind } from '../../generated/prisma/enums';

/**
 * Contrat de `PATCH /admin/entries/:id`.
 *
 * Identique à la création, moins `categoryId` : une fiche ne change pas de
 * catégorie (il faudrait recalculer les positions des deux catégories).
 */
export class UpdateEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  bodyMdx?: string;

  @IsOptional()
  @IsEnum(EntryKind)
  kind?: EntryKind;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsObject()
  files?: Record<string, string>;

  @IsOptional()
  @IsObject()
  dependencies?: Record<string, string>;
}
