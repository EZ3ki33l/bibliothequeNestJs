import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query string de pagination, partagée par toutes les listes admin.
 *
 * Un DTO est le contrat d'entrée de l'API : c'est une **classe** (pas une
 * interface) parce que les décorateurs `class-validator` doivent exister à
 * l'exécution — une interface TypeScript disparaît à la compilation.
 *
 * `@Type(() => Number)` est nécessaire car une query string arrive toujours en
 * texte (`?page=2` → `'2'`) : sans conversion, `@IsInt()` échouerait.
 *
 * Les valeurs par défaut (`= 1`, `= 50`) s'appliquent quand le paramètre est
 * absent. `@Max(50)` est une protection : sans plafond, `?limit=100000` laisse
 * un client vider la table en une requête (déni de service).
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 50;
}
