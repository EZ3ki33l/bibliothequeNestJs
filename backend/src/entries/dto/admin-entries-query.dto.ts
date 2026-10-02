import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Contrat de `GET /admin/entries`.
 *
 * `q` filtre par titre : l'éditeur de parcours s'en sert pour retrouver une
 * fiche sans connaître son identifiant. Contrairement à `GET /entries?q=`, les
 * brouillons sont inclus (on peut préparer un parcours avant de publier ses
 * fiches).
 */
export class AdminEntriesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
