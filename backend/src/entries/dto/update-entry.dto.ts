import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsPastOrPresentDay } from '../../common/calendar-day';
import { Difficulty, EntryKind } from '../../generated/prisma/enums';
import { EntrySourceDto, MAX_ENTRY_SOURCES } from './entry-source.dto';
import {
  IsStringRecord,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  PLAYGROUND_DEPENDENCIES_LIMITS,
  PLAYGROUND_FILES_LIMITS,
  MAX_PLAYGROUND_TEXT_LENGTH,
  PLAYGROUND_TEMPLATES,
} from './playground';

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
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn(PLAYGROUND_TEMPLATES)
  template?: string;

  @IsOptional()
  @IsStringRecord(PLAYGROUND_FILES_LIMITS)
  files?: Record<string, string>;

  @IsOptional()
  @IsStringRecord(PLAYGROUND_DEPENDENCIES_LIMITS)
  dependencies?: Record<string, string>;

  /** Atelier Python : entrée standard, lue par `input()` ligne par ligne. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PLAYGROUND_TEXT_LENGTH)
  playgroundInput?: string;

  /** Atelier Python : sortie attendue ; non vide, elle fait apparaître « Vérifier ». */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PLAYGROUND_TEXT_LENGTH)
  playgroundExpectedOutput?: string;

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
