import { Module } from '@nestjs/common';
import { LearningPathsController } from './learning-paths.controller';
import { AdminLearningPathsController } from './admin-learning-paths.controller';
import { PathProgressController } from './path-progress.controller';
import { StartedPathsController } from './started-paths.controller';
import { LearningPathsService } from './learning-paths.service';
import { PathProgressService } from './path-progress.service';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';

/**
 * Frontière du domaine « parcours » : un contrôleur par niveau d'accès (public,
 * admin, compte connecté), comme `entries/` pour le couple public-admin et
 * `favorites/` pour la partie sous session. Le compte connecté en a deux :
 * la progression (`progress/learning-paths`) et les parcours commencés
 * (`progress/started-paths`).
 */
@Module({
  controllers: [
    LearningPathsController,
    AdminLearningPathsController,
    PathProgressController,
    StartedPathsController,
  ],
  providers: [LearningPathsService, PathProgressService, SessionGuard, AdminGuard],
})
export class LearningPathsModule {}
