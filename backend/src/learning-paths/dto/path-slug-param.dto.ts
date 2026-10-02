import { IsString, MaxLength } from 'class-validator';

/**
 * Paramètre d'URL `:slug` d'un parcours.
 *
 * Pas de regex : un slug mal formé ne correspond simplement à aucun parcours
 * (404). La longueur maximale évite seulement de transmettre une chaîne
 * arbitrairement longue jusqu'à la base.
 */
export class PathSlugParamDto {
  @IsString()
  @MaxLength(120)
  slug!: string;
}
