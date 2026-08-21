import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { buildAuth } from './auth';
import { Observable } from 'rxjs';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const auth = buildAuth(this.prisma);

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException();
    }
    (request as Request & { session: typeof session }).session = session;
    return true;
  }
}
