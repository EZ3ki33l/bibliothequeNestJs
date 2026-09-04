import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StacksModule,
    CategoriesModule,
    EntriesModule,
    ReviewsModule,
    QuizzesModule,
  ],
  controllers: [MeController],
})
export class AppModule {}
