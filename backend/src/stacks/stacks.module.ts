import { Module } from '@nestjs/common';
import { StacksController } from './stacks.controller';
import { AdminStacksController } from './admin-stacks.controller';
import { StacksService } from './stacks.service';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';
import { EntryImagesModule } from '../entry-images/entry-images.module';

/**
 * Frontière du domaine « stacks ».
 *
 * Un module déclare ses `controllers` (la porte HTTP) et ses `providers` (ce
 * qui est injectable à l'intérieur). Les guards figurent dans `providers` parce
 * qu'ils reçoivent `PrismaService` par injection : sans être déclarés, Nest ne
 * saurait pas les instancier.
 */
@Module({
  // Retirer les fichiers des images des fiches emportées par une suppression.
  imports: [EntryImagesModule],
  controllers: [StacksController, AdminStacksController],
  providers: [StacksService, SessionGuard, AdminGuard],
})
export class StacksModule {}
