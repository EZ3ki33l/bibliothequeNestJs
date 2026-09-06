import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Difficulty, EntryKind } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Contrat de `GET /entries` (liste publique, bientôt filtrable).
 *
 * Il étend `PaginationQueryDto` : `page` et `limit` (plafond 50, anti-DoS)
 * restent les mêmes que sur les listes admin. Les champs ci-dessous sont
 * tous optionnels : sans eux, on liste simplement les fiches publiées.
 *
 * Ils sont déclarés **maintenant** pour que `forbidNonWhitelisted` ne
 * refuse pas `?q=` / `?kind=` comme champs inconnus. Le service n'applique
 * ces filtres qu'à partir de la phase 3 (US1).
 */
export class SearchEntriesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(EntryKind)
  kind?: EntryKind;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;
}
