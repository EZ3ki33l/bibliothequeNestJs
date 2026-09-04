import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';
import { StacksService } from './stacks.service';
import { CreateStackDto } from './dto/create-stack.dto';
import { UpdateStackDto } from './dto/update-stack.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

/**
 * CRUD admin des stacks.
 *
 * `@UseGuards` posé sur la **classe** protège toutes les routes du contrôleur :
 * on n'oublie pas une méthode en ajoutant une route (fail closed). Les lectures
 * publiques vivent dans un contrôleur séparé, `StacksController`.
 *
 * Le contrôleur reste mince : il traduit du HTTP (route, code de statut,
 * validation d'entrée) et délègue tout le métier au service.
 */
@Controller('admin/stacks')
@UseGuards(SessionGuard, AdminGuard)
export class AdminStacksController {
  constructor(private readonly stacksService: StacksService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.stacksService.findAllAdmin(query.page, query.limit);
  }

  /**
   * `ParseUUIDPipe` rejette en 400 tout id mal formé, avant d'atteindre la base.
   * Sans lui, `id` serait une chaîne libre venue de l'URL.
   */
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.stacksService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateStackDto) {
    return this.stacksService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStackDto) {
    return this.stacksService.update(id, dto);
  }

  /** 204 : suppression réussie, rien à renvoyer. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.stacksService.delete(id);
  }
}
