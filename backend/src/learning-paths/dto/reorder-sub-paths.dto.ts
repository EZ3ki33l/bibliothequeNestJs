import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { MAX_SUB_PATHS_PER_PATH } from '../learning-paths.service';

/**
 * Nouvel ordre **complet** des sous-parcours d'un parent : même règle que
 * `ReorderModulesDto` (exactement la liste actuelle, sinon 409).
 */
export class ReorderSubPathsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SUB_PATHS_PER_PATH)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  pathIds!: string[];
}
