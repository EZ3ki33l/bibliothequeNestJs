import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Observable } from 'rxjs';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { session?: { user: { id: string } } }>();

    const userId = request.session?.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
    });

    if (!admin) {
      throw new ForbiddenException();
    }
    return true;
  }
}
