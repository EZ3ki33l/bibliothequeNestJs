import { Controller, Get, Param } from '@nestjs/common';
import { StacksService } from './stacks.service';

/**
 * Lectures publiques du catalogue : aucun guard, aucune donnée privée.
 *
 * Elles sont séparées du CRUD admin (`AdminStacksController`) pour que la
 * protection ne dépende pas d'un décorateur oublié sur une méthode : ici tout
 * est public par conception, là-bas tout est gardé par conception.
 */
@Controller('stacks')
export class StacksController {
  constructor(private readonly stacksService: StacksService) {}

  @Get()
  findAll() {
    return this.stacksService.findAll();
  }

  /**
   * URL lisible par slug (`/stacks/react`) plutôt que par UUID : c'est
   * l'adresse que l'utilisateur voit et partage.
   */
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.stacksService.findBySlug(slug);
  }
}
