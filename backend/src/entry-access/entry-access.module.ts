import { Module } from '@nestjs/common';
import { EntryAccessController } from './entry-access.controller';
import { EntryAccessService } from './entry-access.service';

/**
 * Frontière du domaine « accès aux fiches » : quelles fiches se lisent sans
 * compte, et ce lecteur peut-il lire celle-ci.
 *
 * Module à part parce que trois domaines posent la même question (`entries/`,
 * `quizzes/`, `entry-progress/`). `exports` rend `EntryAccessService`
 * injectable dans les modules qui importent celui-ci : c'est la façon dont un
 * module Nest partage un service, sans que les autres touchent à sa requête.
 */
@Module({
  controllers: [EntryAccessController],
  providers: [EntryAccessService],
  exports: [EntryAccessService],
})
export class EntryAccessModule {}
