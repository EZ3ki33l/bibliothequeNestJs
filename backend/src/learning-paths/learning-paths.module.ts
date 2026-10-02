import { Module } from '@nestjs/common';
import { LearningPathsController } from './learning-paths.controller';
import { AdminLearningPathsController } from './admin-learning-paths.controller';
import { PathProgressController } from './path-progress.controller';
import { LearningPathsService } from './learning-paths.service';
import { PathProgressService } from './path-progress.service';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';

/**
 * Frontière du domaine « parcours » : trois contrôleurs, un par niveau d'accès
 * (public, admin, compte connecté), comme `entries/` pour le couple
 * public-admin et `favorites/` pour la partie sous session.
 */
@Module({
  controllers: [LearningPathsController, AdminLearningPathsController, PathProgressController],
  providers: [LearningPathsService, PathProgressService, SessionGuard, AdminGuard],
})
export class LearningPathsModule {}
