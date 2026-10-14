import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_ALT_LENGTH, MAX_CAPTION_LENGTH } from './upload-entry-image.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Corps de `PATCH /admin/entries/:entryId/images/:imageId` : texte alternatif
 * et légende, mêmes règles qu'à l'envoi. Le fichier ne change pas : pour une
 * autre image, en envoyer une autre. Un corps sans aucun des deux champs est
 * refusé par le service (rien à modifier).
 */
export class UpdateEntryImageDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Le texte alternatif est obligatoire.' })
  @IsNotEmpty({ message: 'Le texte alternatif est obligatoire.' })
  @MaxLength(MAX_ALT_LENGTH, {
    message: `Le texte alternatif fait ${MAX_ALT_LENGTH} caractères au plus.`,
  })
  alt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La légende doit être un texte.' })
  @MaxLength(MAX_CAPTION_LENGTH, {
    message: `La légende fait ${MAX_CAPTION_LENGTH} caractères au plus.`,
  })
  caption?: string;
}
