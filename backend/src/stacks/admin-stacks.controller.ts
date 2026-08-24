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
import { StackService } from './stacks.service';
import { CreateStackDto } from './dto/create-stack.dto';
import { UpdateStackDto } from './dto/update-stack.dto';
import { ListStacksQueryDto } from './dto/list-stacks-query.dto';

@Controller('admin/stacks')
@UseGuards(SessionGuard, AdminGuard)
export class AdminStackController {
  constructor(private readonly stacksService: StackService) {}

  @Get()
  findAll(@Query() query: ListStacksQueryDto) {
    return this.stacksService.findAllAdmin(query.page, query.limit);
  }

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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.stacksService.delete(id);
  }
}
