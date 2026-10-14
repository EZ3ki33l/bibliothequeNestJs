import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AdminCategoriesController } from './admin-categories.controller';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';
import { EntryImagesModule } from '../entry-images/entry-images.module';

/** Frontière du domaine « catégories ». */
@Module({
  // Retirer les fichiers des images des fiches emportées par une suppression.
  imports: [EntryImagesModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService, SessionGuard, AdminGuard],
})
export class CategoriesModule {}
