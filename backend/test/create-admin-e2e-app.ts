import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../src/app.module';

export async function createAdminE2eApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      $connect: () => Promise.resolve(),
      $disconnect: () => Promise.resolve(),
      admin: { findUnique: () => Promise.resolve(null) },
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
