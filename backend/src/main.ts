import 'dotenv/config';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { PrismaService } from '../prisma/prisma.service';
import { buildAuth } from './auth/auth';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

  app.enableCors({
    origin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const prisma = app.get(PrismaService);
  const auth = buildAuth(prisma);
  const expressApp = app.getHttpAdapter().getInstance() as express.Express;

  //Express 5 (Nest11) : joker *splat

  expressApp.all(`/api/auth/*splat`, toNodeHandler(auth));
  expressApp.use(express.json());

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
