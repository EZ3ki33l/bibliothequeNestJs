import { Module } from '@nestjs/common';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';
import { AdminEntriesController } from './admin-entry.controller';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { ReaderEntriesController } from './reader-entries.controller';
import { EntryAccessModule } from '../entry-access/entry-access.module';

/**
 * Frontière du domaine « fiches » : un contrôleur public, un contrôleur de
 * lecture complète (compte vérifié), un contrôleur admin.
 *
 * `EntryAccessModule` est importé pour que `EntriesService` puisse demander
 * si une fiche est en accès libre : la règle vit là-bas, pas ici.
 */
@Module({
  imports: [EntryAccessModule],
  controllers: [EntriesController, ReaderEntriesController, AdminEntriesController],
  providers: [EntriesService, SessionGuard, AdminGuard, VerifiedEmailGuard],
})
export class EntriesModule {}
