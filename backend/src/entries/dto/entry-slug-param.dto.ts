import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Paramètre d'URL `:slug` de la lecture complète d'une fiche
 * (`GET /reader/entries/:slug`).
 *
 * Pas de regex : un slug mal formé ne correspond simplement à aucune fiche
 * (404). La longueur maximale évite seulement de transmettre une chaîne
 * arbitrairement longue jusqu'à la base.
 */
export class EntrySlugParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  slug!: string;
}
