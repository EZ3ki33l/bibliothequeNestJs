import { Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { EntryImagesService, type MediaVariant } from './entry-images.service';

/**
 * Relais public des images (spec 016, research § 7).
 *
 * Le navigateur du lecteur ne contacte **jamais** le prestataire de stockage :
 * il demande `/media/<id>/<variant>` au site, qui va chercher le fichier (ou le
 * sert depuis son cache). Aucune garde, aucune session lue : comme les autres
 * lectures publiques, la réponse est la même pour tous.
 *
 * `@Throttle` : 600 requêtes par minute et par adresse, au lieu des 100 de la
 * règle globale. Une page de vingt images, consultée depuis une salle de
 * formation derrière une seule adresse, dépasserait vite 100 ; une adresse
 * inconnue ne coûte qu'une lecture d'index.
 */
@Controller('media')
@Throttle({ default: { limit: 600, ttl: 60_000 } })
export class MediaController {
  constructor(private readonly images: EntryImagesService) {}

  @Get(':imageId/:variant')
  async read(
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Param('variant', new ParseEnumPipe({ reading: 'reading', full: 'full' }))
    variant: MediaVariant,
    @Res() response: Response,
  ): Promise<void> {
    const body = await this.images.readVariant(imageId, variant);

    response.set({
      'Content-Type': 'image/webp',
      // Une version ne change jamais : un nouvel envoi a un nouvel identifiant.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Helmet pose `same-origin` : la SPA, sur une autre origine, ne pourrait
      // pas afficher l'image. Les images sont publiques par décision (spec 016,
      // Q2) : `cross-origin` ne révèle rien de plus.
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    });
    response.send(body);
  }
}
