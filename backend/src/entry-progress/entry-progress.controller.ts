import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser, CurrentUserId } from '../auth/current-user.decorator';
import type { SessionUser } from '../auth/authed-request';
import { EntryProgressService } from './entry-progress.service';
import { EntryIdsQueryDto } from '../common/dto/entry-ids-query.dto';

/**
 * Ce que le compte connecté a fait des fiches. `SessionGuard` suffit (pas
 * d'`AdminGuard`) : chacun lit et écrit **ses** repères, et aucune route
 * n'accepte d'identifiant de compte, il vient de la session (`@CurrentUserId()`).
 *
 * Ces routes sont séparées des lectures publiques (`GET /entries/:slug`,
 * `GET /stacks…`) exprès : une lecture publique répond la même chose à tout le
 * monde, sans lire de cookie. Ce qui est personnel se demande ici.
 */
@Controller('progress/entries')
@UseGuards(SessionGuard)
export class EntryProgressController {
  constructor(private readonly entryProgressService: EntryProgressService) {}

  /** Repères (lue, meilleur score, favori) des fiches demandées, 50 au plus. */
  @Get()
  findStates(@Query() query: EntryIdsQueryDto, @CurrentUserId() userId: string) {
    return this.entryProgressService.findStates(userId, query.ids);
  }

  /**
   * Compte la fiche comme lue. `PUT` plutôt que `POST` : l'appel est idempotent,
   * dix ouvertures ne laissent qu'une trace. `204` : il n'y a rien à renvoyer.
   * `ParseUUIDPipe` refuse en 400 un identifiant mal formé avant le service.
   *
   * `@CurrentUser()` : le service refuse (403) la trace d'une fiche que ce
   * compte ne peut pas lire, il lui faut donc l'état de l'adresse.
   */
  @Put(':entryId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.entryProgressService.markRead(user, entryId);
  }
}
