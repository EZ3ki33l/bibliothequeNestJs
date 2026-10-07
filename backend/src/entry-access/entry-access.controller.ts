import { Controller, Get, Query } from '@nestjs/common';
import { EntryIdsQueryDto } from '../common/dto/entry-ids-query.dto';
import { EntryAccessService } from './entry-access.service';

/**
 * Lectures **publiques** de l'accès aux fiches : aucune garde, exprès.
 *
 * Savoir qu'une fiche se lit sans compte n'est pas un secret : la page d'un
 * parcours le montre déjà (le premier module est ouvert, les suivants non).
 * La réponse est la même pour tout le monde et ne lit aucun cookie, comme
 * toute lecture publique du dépôt. Ce qui est protégé, c'est le **contenu**
 * d'une fiche réservée, et il ne passe pas par ici.
 *
 * Le préfixe est `access/`, pas `entries/access` : ce dernier serait capturé
 * par `GET /entries/:slug` (Nest y lirait « access » comme un slug), et
 * masquerait une fiche dont le slug serait justement `access`.
 */
@Controller('access')
export class EntryAccessController {
  constructor(private readonly entryAccessService: EntryAccessService) {}

  /**
   * Accès (libre ou réservé) des fiches demandées, 50 au plus : la borne du
   * DTO empêche une seule requête de faire lire des milliers de lignes.
   */
  @Get('entries')
  findAccess(@Query() query: EntryIdsQueryDto) {
    return this.entryAccessService.findAccess(query.ids);
  }

  /** Nombre de fiches en accès libre, pour l'alerte du tableau de bord. */
  @Get('summary')
  summary() {
    return this.entryAccessService.summary();
  }
}
