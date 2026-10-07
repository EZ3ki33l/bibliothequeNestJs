import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** États filtrables d'une fiche dans l'administration. */
export const ADMIN_ENTRY_STATUSES = ['draft', 'published'] as const;
export type AdminEntryStatus = (typeof ADMIN_ENTRY_STATUSES)[number];

/**
 * Contrat de `GET /admin/entries`.
 *
 * `q` filtre par titre : l'éditeur de parcours s'en sert pour retrouver une
 * fiche sans connaître son identifiant. Contrairement à `GET /entries?q=`, les
 * brouillons sont inclus (on peut préparer un parcours avant de publier ses
 * fiches).
 *
 * Les autres filtres servent à la liste des fiches : retrouver les brouillons
 * d'une catégorie ou d'un parcours sans parcourir tout le catalogue. Ils se
 * combinent en ET ; un filtre absent ne contraint rien.
 *
 * `status` est une chaîne et non un booléen : une query string arrive toujours
 * en texte, et convertir `'false'` en booléen donne `true` (toute chaîne non
 * vide est « vraie »). Une liste fermée de valeurs évite ce piège.
 */
export class AdminEntriesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(ADMIN_ENTRY_STATUSES)
  status?: AdminEntryStatus;

  @IsOptional()
  @IsUUID()
  stackId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  pathId?: string;
}

/** Filtres de la liste admin, sans la pagination : ce que reçoit le service. */
export type AdminEntriesFilters = Pick<
  AdminEntriesQueryDto,
  'q' | 'status' | 'stackId' | 'categoryId' | 'pathId'
>;
