import 'dotenv/config';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { PrismaService } from '../prisma/prisma.service';
import { getAuth } from './auth/auth';

/**
 * Point d'entrée du serveur : tout ce qui vaut pour **toute** l'application se
 * branche ici (CORS, validation, montage de better-auth), plutôt que d'être
 * répété dans chaque module.
 */
async function bootstrap() {
  // `bodyParser: false` : better-auth doit recevoir le corps brut de la requête
  // pour ses propres routes. On rebranche le parseur JSON juste après, pour le
  // reste de l'API (voir plus bas — l'ordre des middlewares compte).
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Une seule origine explicite, jamais `*` : avec `credentials: true`, le
  // navigateur envoie le cookie de session, donc autoriser n'importe quelle
  // origine laisserait un autre site agir au nom de l'utilisateur.
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  /**
   * Validation globale des entrées : aucune requête n'atteint un contrôleur
   * sans être passée par le DTO correspondant.
   *
   * - `whitelist` : supprime les champs non déclarés dans le DTO ;
   * - `forbidNonWhitelisted` : va plus loin et rejette la requête en 400
   *   (le client saura qu'il envoie un champ inconnu, au lieu de croire qu'il a
   *   été pris en compte) ;
   * - `transform` : instancie le DTO et applique les conversions de type
   *   (`?page=2` → nombre), sans quoi `@IsInt()` échouerait.
   *
   * Ensemble, ces options ferment le « mass assignment » : un client ne peut
   * pas écrire une colonne qui n'est pas dans le contrat.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const prisma = app.get(PrismaService);
  const auth = getAuth(prisma);
  const expressApp = app.getHttpAdapter().getInstance() as express.Express;

  // better-auth gère lui-même `/api/auth/*` (inscription, connexion, session) :
  // on lui délègue ces routes avant tout parsing du corps.
  // Express 5 (Nest 11) : le joker s'écrit `*splat`, plus `*`.
  expressApp.all(`/api/auth/*splat`, toNodeHandler(auth));
  expressApp.use(express.json());

  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
