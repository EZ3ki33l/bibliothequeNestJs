import { Controller, Get, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('stacks/:stackSlug/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get(':categorySlug')
  findBySlugs(@Param('stackSlug') stackSlug: string, @Param('categorySlug') categorySlug: string) {
    return this.categoriesService.findBySlugs(stackSlug, categorySlug);
  }
}
