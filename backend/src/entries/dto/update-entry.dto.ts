import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsPastOrPresentDay } from '../../common/calendar-day';
import { Difficulty, EntryKind } from '../../generated/prisma/enums';
import { EntrySourceDto, MAX_ENTRY_SOURCES } from './entry-source.dto';

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

  /**
   * Absent : la liste des sources n'est pas touchée. Présent : elle est
   * remplacée en entier (`[]` les retire toutes). Voir `CreateEntryDto` pour
   * `@ValidateNested` et `@Type`.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ENTRY_SOURCES)
  @ValidateNested({ each: true })
  @Type(() => EntrySourceDto)
  sources?: EntrySourceDto[];

  /** Absent : inchangé. `null` : la date est effacée. */
  @IsOptional()
  @IsPastOrPresentDay()
  verifiedOn?: string | null;

  /** Version pour laquelle la fiche a été vérifiée (« React 19 »). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  verifiedVersion?: string;
}
