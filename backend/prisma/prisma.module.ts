import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Accès à la base, disponible dans toute l'application.
 *
 * `@Global()` évite d'importer ce module dans chacun des modules de domaine.
 * C'est une exception réservée aux briques transverses (configuration, base,
 * journalisation) : en abuser masquerait les dépendances réelles entre modules.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
