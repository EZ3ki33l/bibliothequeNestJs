import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** Nombre maximal de fiches qu'une seule requête peut désigner. */
export const MAX_ENTRY_IDS = 50;

/**
 * Contrat des lectures qui prennent une liste de fiches dans l'adresse :
 * `GET /progress/entries?ids=<uuid>,<uuid>…` (repères du compte) et
 * `GET /access/entries?ids=…` (accès libre ou réservé). Partagé dans
 * `common/dto/` pour que les deux routes tiennent la même borne.
 *
 * Une adresse ne transporte que du texte : `ids` arrive sous la forme d'une
 * seule chaîne, « a,b,c ». `@Transform` la découpe en tableau **avant** la
 * validation, qui peut alors contrôler chaque élément (`each: true`). Les
 * décorateurs de `class-transformer` s'exécutent quand le corps brut devient
 * une instance du DTO, donc avant ceux de `class-validator`.
 *
 * `@Transform` n'est appliqué que parce que le `ValidationPipe` global est
 * configuré avec `transform: true` (`main.ts`). Sans cette option, `ids`
 * resterait une chaîne et `@IsArray()` refuserait toutes les requêtes.
 *
 * La borne de 50 est un contrôle de sécurité autant qu'un contrat : sans elle,
 * une seule requête pourrait demander des milliers de fiches et faire
 * travailler la base à volonté.
 */
export class EntryIdsQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ENTRY_IDS)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
