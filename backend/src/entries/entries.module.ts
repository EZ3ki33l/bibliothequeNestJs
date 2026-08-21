import { Module } from '@nestjs/common';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';
import { AdminEntriesController } from './admin-entry.controller';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  controllers: [EntriesController, AdminEntriesController],
  providers: [EntriesService, SessionGuard, AdminGuard],
})
export class EntriesModule {}
