import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Difficulty, EntryKind } from '../../generated/prisma/enums';

export class CreateEntryDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  bodyMdx?: string;

  @IsEnum(EntryKind)
  kind!: EntryKind;

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
