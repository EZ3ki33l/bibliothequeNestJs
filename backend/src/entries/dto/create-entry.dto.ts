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

/**
 * Contrat de `POST /admin/entries`.
 *
 * Tout est optionnel sauf la catégorie, le titre et le type : une fiche peut
 * naître à l'état d'ébauche et se compléter ensuite. Les défauts (`published:
 * false` notamment) sont appliqués par le service, pas ici.
 */
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
