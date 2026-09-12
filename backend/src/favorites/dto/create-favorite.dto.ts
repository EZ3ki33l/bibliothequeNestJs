import { IsUUID } from 'class-validator';

/**
 * Contrat de `POST /favorites`.
 *
 * Seule la fiche est fournie : le propriétaire du favori vient de la session
 * (`@CurrentUserId()`). Accepter un `userId` dans le corps laisserait créer
 * des favoris au nom d'autrui.
 */
export class CreateFavoriteDto {
  @IsUUID()
  entryId!: string;
}
