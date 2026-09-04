import { IsUUID } from 'class-validator';

/**
 * Contrat de `POST /reviews/ensure`.
 *
 * Seule la fiche est fournie : le propriétaire de la carte vient de la session
 * (`@CurrentUserId()`). Accepter un `userId` dans le corps laisserait créer des
 * cartes au nom d'autrui.
 */
export class EnsureReviewDto {
  @IsUUID()
  entryId!: string;
}
