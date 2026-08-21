import { Module } from '@nestjs/common';
import { StacksController } from './stacks.controller';
import { StackService } from './stacks.service';
import { AdminStackController } from './admin-stacks.controller';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  controllers: [StacksController, AdminStackController],
  providers: [StackService, SessionGuard, AdminGuard],
})
export class StacksModule {}
