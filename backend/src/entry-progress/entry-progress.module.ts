import { Module } from '@nestjs/common';
import { EntryProgressController } from './entry-progress.controller';
import { EntryProgressService } from './entry-progress.service';
import { SessionGuard } from '../auth/session.guard';
import { EntryAccessModule } from '../entry-access/entry-access.module';

/**
 * Frontière du domaine « ce qu'un compte a fait d'une fiche » : trace de
 * lecture et repères.
 *
 * Module à part plutôt qu'une méthode de `entries/` : `EntriesService` ne
 * manipule que du contenu et ne reçoit jamais de `userId`. Ici, tout dépend du
 * compte connecté, comme dans `favorites/` et `notes/`.
 *
 * `EntryAccessModule` : la trace de lecture n'est écrite que pour une fiche
 * que le compte a le droit de lire.
 */
@Module({
  imports: [EntryAccessModule],
  controllers: [EntryProgressController],
  providers: [EntryProgressService, SessionGuard],
})
export class EntryProgressModule {}
