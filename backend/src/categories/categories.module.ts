import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AdminCategoriesController } from './admin-categories.controller';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService, SessionGuard, AdminGuard],
})
export class CategoriesModule {}
