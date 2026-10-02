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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';
import { LearningPathsService } from './learning-paths.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateLearningPathDto } from './dto/create-learning-path.dto';
import { UpdateLearningPathDto } from './dto/update-learning-path.dto';
import { CreatePathModuleDto } from './dto/create-path-module.dto';
import { UpdatePathModuleDto } from './dto/update-path-module.dto';
import { CreatePathStepDto } from './dto/create-path-step.dto';
import { UpdatePathStepDto } from './dto/update-path-step.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';
import { ReorderStepsDto } from './dto/reorder-steps.dto';

/**
 * Composition admin des parcours : parcours, modules, étapes et leur ordre.
 * Toutes les routes exigent une session admin ; contrairement aux lectures
 * publiques, elles voient aussi les brouillons.
 *
 * Les écritures sur un module ou une étape renvoient le détail complet du
 * parcours : l'éditeur remplace son état d'un bloc, sans second aller-retour.
 *
 * `PUT …/modules/order` est déclaré **avant** les routes `…/modules/:moduleId`
 * pour que le mot `order` ne soit jamais lu comme un identifiant (même si
 * `ParseUUIDPipe` le refuserait de toute façon).
 */
@Controller('admin/learning-paths')
@UseGuards(SessionGuard, AdminGuard)
export class AdminLearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  // Parcours

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.learningPathsService.findAllAdmin(query.page, query.limit);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.learningPathsService.findAdminDetail(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLearningPathDto) {
    return this.learningPathsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLearningPathDto) {
    return this.learningPathsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.learningPathsService.delete(id);
  }

  // Modules

  @Put(':id/modules/order')
  reorderModules(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderModulesDto) {
    return this.learningPathsService.reorderModules(id, dto.moduleIds);
  }

  @Post(':id/modules')
  @HttpCode(HttpStatus.CREATED)
  addModule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePathModuleDto) {
    return this.learningPathsService.addModule(id, dto);
  }

  @Patch(':id/modules/:moduleId')
  updateModule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: UpdatePathModuleDto,
  ) {
    return this.learningPathsService.updateModule(id, moduleId, dto);
  }

  @Delete(':id/modules/:moduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteModule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.learningPathsService.deleteModule(id, moduleId);
  }

  // Étapes

  @Put(':id/modules/:moduleId/steps/order')
  reorderSteps(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: ReorderStepsDto,
  ) {
    return this.learningPathsService.reorderSteps(id, moduleId, dto.stepIds);
  }

  @Post(':id/modules/:moduleId/steps')
  @HttpCode(HttpStatus.CREATED)
  addStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CreatePathStepDto,
  ) {
    return this.learningPathsService.addStep(id, moduleId, dto);
  }

  @Patch(':id/steps/:stepId')
  updateStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: UpdatePathStepDto,
  ) {
    return this.learningPathsService.updateStep(id, stepId, dto);
  }

  @Delete(':id/steps/:stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.learningPathsService.deleteStep(id, stepId);
  }
}
