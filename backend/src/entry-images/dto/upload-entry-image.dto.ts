import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Longueurs maximales du texte alternatif et de la légende (FR-013). */
export const MAX_ALT_LENGTH = 250;
export const MAX_CAPTION_LENGTH = 300;

/** Retire les espaces autour d'une saisie ; laisse passer ce qui n'est pas du texte (rejeté ensuite). */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Champs texte de `POST /admin/entries/:entryId/images` (multipart).
 *
 * Le fichier lui-même n'est pas ici : `FileInterceptor` le place dans
 * `@UploadedFile()`. Les autres parties du formulaire arrivent dans `@Body()`
 * comme du texte, et le `ValidationPipe` global les valide avec ce DTO comme
 * un corps JSON : une partie inconnue donne un 400 (`forbidNonWhitelisted`).
 *
 * Le texte alternatif est **obligatoire** : une image du site a toujours de
 * quoi être décrite à un lecteur d'écran, et à l'examen.
 */
export class UploadEntryImageDto {
  @Transform(trim)
  @IsString({ message: 'Le texte alternatif est obligatoire.' })
  @IsNotEmpty({ message: 'Le texte alternatif est obligatoire.' })
  @MaxLength(MAX_ALT_LENGTH, {
    message: `Le texte alternatif fait ${MAX_ALT_LENGTH} caractères au plus.`,
  })
  alt!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'La légende doit être un texte.' })
  @MaxLength(MAX_CAPTION_LENGTH, {
    message: `La légende fait ${MAX_CAPTION_LENGTH} caractères au plus.`,
  })
  caption?: string;
}
