import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { EntriesService } from './entries.service';
import { EntrySlugParamDto } from './dto/entry-slug-param.dto';

/**
 * Lecture **complète** d'une fiche, pour un compte dont l'adresse est vérifiée.
 *
 * Pourquoi une seconde route, plutôt qu'une session facultative sur
 * `GET /entries/:slug` ? Parce qu'une lecture publique répond la même chose à
 * tout le monde, sans lire de cookie : c'est la règle du dépôt. Avec une
 * session facultative, la même adresse renverrait tantôt l'en-tête, tantôt le
 * contenu, selon un contrôle écrit à la main dans le service ; un oubli, et
 * tout le catalogue sortirait. Ici, le contenu d'une fiche réservée n'a qu'une
 * porte, et les deux guards sont visibles sur la classe.
 *
 * L'ordre des guards compte : `SessionGuard` identifie (401), puis
 * `VerifiedEmailGuard` autorise (403). Ils passent **avant** le service : un
 * compte non vérifié reçoit 403 pour n'importe quel slug, donc la route ne dit
 * rien de l'existence d'un brouillon.
 *
 * Aucun identifiant de compte dans l'adresse : le droit vient de la session.
 */
@Controller('reader/entries')
@UseGuards(SessionGuard, VerifiedEmailGuard)
export class ReaderEntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get(':slug')
  findReadableBySlug(@Param() params: EntrySlugParamDto) {
    return this.entriesService.findReadableBySlug(params.slug);
  }
}
