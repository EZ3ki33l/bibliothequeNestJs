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
