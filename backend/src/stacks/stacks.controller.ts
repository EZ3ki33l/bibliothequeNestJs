import { Controller, Get, Param } from '@nestjs/common';
import { StackService } from './stacks.service';

@Controller('stacks')
export class StacksController {
  constructor(private readonly stacksService: StackService) {}

  @Get()
  findAll() {
    return this.stacksService.findAll();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.stacksService.findBySlug(slug);
  }
}
