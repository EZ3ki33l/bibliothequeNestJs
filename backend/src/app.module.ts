import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { MeController } from './auth/me.controller';
import { StacksModule } from './stacks/stacks.module';
import { CategoriesModule } from './categories/categories.module';
import { EntriesModule } from './entries/entries.module';
import { ReviewsModule } from './reviews/reviews.module';
import { QuizzesModule } from './quizzes/quizzes.module';

/**
 * Module racine : il assemble les modules de domaine, il ne contient pas de
 * logique métier. Chaque feature vit dans son dossier (`stacks/`, `entries/`…)
 * et s'ajoute ici pour être montée.
 *
 * `ConfigModule.forRoot({ isGlobal: true })` lit `.env` au démarrage et rend la
 * configuration injectable partout : c'est l'alternative propre à des
 * `process.env` dispersés dans le code (une variable manquante se voit au boot,
 * pas à la première requête). Un changement de `.env` demande un redémarrage.
 *
 * `ThrottlerModule` + `APP_GUARD` : 100 requêtes Nest / minute / IP. Les routes
 * better-auth (`/api/auth`) ne passent pas par ce guard (voir `main.ts`).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    PrismaModule,
    StacksModule,
    CategoriesModule,
    EntriesModule,
    ReviewsModule,
    QuizzesModule,
  ],
  controllers: [MeController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
