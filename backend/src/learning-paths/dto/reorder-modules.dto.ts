import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/**
 * Nouvel ordre **complet** des modules d'un parcours.
 *
 * Envoyer toute la liste (plutôt que « monte ce module d'un cran ») rend
 * l'opération vérifiable : le serveur exige exactement les modules actuels, ni
 * plus ni moins. Sinon la composition a changé entre-temps (autre onglet) et
 * la requête est refusée (409) au lieu d'écrire un ordre incohérent.
 */
export class ReorderModulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  moduleIds!: string[];
}
