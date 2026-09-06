import 'dotenv/config';
import * as express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { PrismaService } from '../prisma/prisma.service';
import { getAuth } from './auth/auth';

/**
 * Point d'entrée du serveur : tout ce qui vaut pour **toute** l'application se
 * branche ici (Helmet, CORS, validation, montage de better-auth), plutôt que
 * d'être répété dans chaque module.
 */
async function bootstrap() {
  // `bodyParser: false` : better-auth doit recevoir le corps brut de la requête
  // pour ses propres routes. On rebranche le parseur JSON juste après, pour le
  // reste de l'API (voir plus bas — l'ordre des middlewares compte).
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // En-têtes de sécurité (CSP, frameguard, nosniff…). Premier middleware :
  // une réponse part déjà avec une politique trop ouverte si Helmet arrive
  // après CORS ou le parseur.
  app.use(helmet());

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

  // Derrière nginx / Caddy, toutes les requêtes arrivent avec l'IP du proxy.
  // Sans `trust proxy`, le rate-limit (et le throttler) voient une seule
  // machine : un attaquant bloque tout le monde, ou tout le monde partage
  // le même quota (OWASP brute force / rate limiting). `1` = un saut de
  // proxy, pas `true` (un client pourrait sinon forger X-Forwarded-For).
  expressApp.set('trust proxy', 1);

  // Login / register ne passent pas par Nest : plafond plus strict, hors GET
  // de session. 10 POST / 15 min / IP : assez pour un humain, trop bas pour
  // un script de force brute (OWASP brute force).
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { statusCode: 429, message: 'Trop de tentatives. Réessayer plus tard.' },
  });
  expressApp.use('/api/auth/sign-in', authLimiter);
  expressApp.use('/api/auth/sign-up', authLimiter);

  // better-auth gère lui-même `/api/auth/*` (inscription, connexion, session) :
  // on lui délègue ces routes avant tout parsing du corps.
  // Express 5 (Nest 11) : le joker s'écrit `*splat`, plus `*`.
  expressApp.all(`/api/auth/*splat`, toNodeHandler(auth));
  // Limite explicite (défaut Express = 100kb) : un body énorme est un DoS.
  expressApp.use(express.json({ limit: '100kb' }));

  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
