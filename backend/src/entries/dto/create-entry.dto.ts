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
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsPastOrPresentDay } from '../../common/calendar-day';
import { Difficulty, EntryKind } from '../../generated/prisma/enums';
import { EntrySourceDto, MAX_ENTRY_SOURCES } from './entry-source.dto';

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

  /**
   * Sources de la fiche, dans l'ordre d'affichage (le rang est l'index du
   * tableau, calculé par le service).
   *
   * `@ValidateNested({ each: true })` demande de valider **chaque** élément
   * avec les règles de sa classe. `@Type(() => EntrySourceDto)` dit à
   * `class-transformer` en quelle classe transformer ces éléments : sans lui,
   * le tableau contient des objets littéraux, dont le contenu n'est pas validé
   * — un lien `javascript:` passerait.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ENTRY_SOURCES)
  @ValidateNested({ each: true })
  @Type(() => EntrySourceDto)
  sources?: EntrySourceDto[];

  /**
   * Jour où la fiche a été relue face à sa source, `AAAA-MM-JJ`. `null`
   * l'efface. `@IsOptional()` laisse passer `null` comme `undefined` : c'est le
   * service qui distingue « absent » (inchangé) de `null` (effacé).
   */
  @IsOptional()
  @IsPastOrPresentDay()
  verifiedOn?: string | null;

  /** Version pour laquelle la fiche a été vérifiée (« React 19 »). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  verifiedVersion?: string;
}
