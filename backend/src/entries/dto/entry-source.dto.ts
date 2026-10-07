import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  type ValidationArguments,
} from 'class-validator';
import { IsPastOrPresentDay } from '../../common/calendar-day';

/** Nombre maximal de sources par fiche. */
export const MAX_ENTRY_SOURCES = 10;

/** Retire les espaces autour d'une saisie ; laisse passer ce qui n'est pas du texte (rejeté ensuite par `@IsString`). */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Seul le protocole `https:` est accepté, et il doit être écrit.
 *
 * Le brouillon d'un `ADMIN` est relu par un `SUPER_ADMIN`. Un lien
 * `javascript:` enregistré ici s'exécuterait dans la session de celui qui
 * relit (XSS stockée, OWASP A03). La liste est une liste d'**autorisation** :
 * tout ce qui n'est pas `https:` est refusé, sans chercher à énumérer ce qui
 * est dangereux.
 */
const HTTPS_ONLY = { protocols: ['https'], require_protocol: true };

const httpsMessage = ({ property }: ValidationArguments) =>
  `${property} doit être une adresse commençant par https://`;

/**
 * Une source d'une fiche : le document d'origine, et ce qu'il faut pour le
 * créditer.
 *
 * Ce DTO n'est jamais reçu seul : `CreateEntryDto` et `UpdateEntryDto` le
 * contiennent dans un tableau (`sources`). C'est un **DTO imbriqué** : le
 * `ValidationPipe` valide chaque élément du tableau avec cette classe, à
 * condition que le champ parent porte `@ValidateNested({ each: true })` et
 * `@Type(() => EntrySourceDto)`.
 *
 * Toutes les longueurs sont bornées, et `forbidNonWhitelisted` s'applique
 * aussi ici : un champ inconnu dans une source donne un 400.
 */
export class EntrySourceDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(2048)
  @IsUrl(HTTPS_ONLY, { message: httpsMessage })
  url!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  publisher?: string;

  /** Jour de consultation, `AAAA-MM-JJ`. */
  @IsOptional()
  @IsPastOrPresentDay()
  consultedOn?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  licenseName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(HTTPS_ONLY, { message: httpsMessage })
  licenseUrl?: string;

  /** `true` : la fiche est une adaptation de ce document (« Adapté de »). */
  @IsOptional()
  @IsBoolean()
  adapted?: boolean;
}
