import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Client Prisma géré par Nest.
 *
 * En héritant de `PrismaClient`, le service *est* le client : les autres
 * services écrivent `this.prisma.entry.findMany(...)` sans intermédiaire. Et
 * comme c'est un provider injectable, un test peut le remplacer par un faux
 * objet — c'est ce que font tous les `*.service.spec.ts`.
 *
 * `OnModuleInit` / `OnModuleDestroy` sont les crochets de cycle de vie de Nest :
 * la connexion s'ouvre au démarrage de l'application et se ferme à l'arrêt.
 * Sans la fermeture, le processus garderait des connexions PostgreSQL ouvertes.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Réserve de connexions PostgreSQL (Prisma 7 + `@prisma/adapter-pg`).
   *
   * Elle est conservée ici parce que Prisma ne la ferme pas lui-même : c'est à
   * nous d'appeler `pool.end()` à l'arrêt.
   */
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    // `getOrThrow` : sans `DATABASE_URL`, l'application refuse de démarrer.
    // Mieux vaut un échec immédiat et explicite qu'une première requête qui
    // tombe en erreur une fois le serveur en ligne.
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    const pool = new Pool({ connectionString });

    // `super(...)` doit être appelé avant tout accès à `this`, d'où la
    // variable locale `pool` réutilisée juste après.
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
