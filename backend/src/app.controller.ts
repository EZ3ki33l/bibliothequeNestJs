import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { SessionGuard } from './auth/session.guard';
import { AdminGuard } from './auth/admin.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: Request & { session?: { user: unknown } }) {
    return request.session?.user;
  }

  @Get('/admin/me')
  @UseGuards(SessionGuard, AdminGuard)
  adminMe(@Req() request: Request & { session?: { user: unknown } }) {
    return request.session?.user;
  }
}
