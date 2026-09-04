import { Controller, Get, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';

/**
 * Lecture publique d'une catégorie, imbriquée sous son stack.
 *
 * L'URL reflète l'appartenance (`/stacks/react/categories/hooks`) parce que le
 * slug d'une catégorie n'est unique que dans son stack : « hooks » peut exister
 * sous React et sous Vue.
 */
@Controller('stacks/:stackSlug/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get(':categorySlug')
  findBySlugs(@Param('stackSlug') stackSlug: string, @Param('categorySlug') categorySlug: string) {
    return this.categoriesService.findBySlugs(stackSlug, categorySlug);
  }
}
