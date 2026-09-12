import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Contrat de `GET /favorites`. `entryId` optionnel : présent, il réduit la
 * liste à 0 ou 1 favori (utilisé par la fiche pour lire son propre état) ;
 * absent, on liste tous les favoris publiés du compte connecté.
 */
export class ListFavoritesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  entryId?: string;
}
