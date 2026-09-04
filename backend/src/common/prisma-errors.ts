import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

/**
 * Traduction des erreurs d'écriture Prisma en exceptions HTTP Nest.
 *
 * Prisma ne connaît pas HTTP : il signale un problème par un *code*
 * (`PrismaClientKnownRequestError`). C'est à nous de décider quel statut HTTP
 * correspond, et de le faire au même endroit pour tous les domaines — sinon la
 * même contrainte de base renvoie 409 dans un service et 500 dans un autre.
 *
 * Codes que ce projet rencontre : https://www.prisma.io/docs/orm/reference/error-reference
 */
const UNIQUE_CONSTRAINT_FAILED = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

/**
 * Vrai si l'erreur est une violation de contrainte d'unicité (slug déjà pris,
 * carte de révision déjà créée…).
 *
 * Utile quand le doublon n'est pas une erreur métier : `ReviewsService.ensure`
 * veut l'ignorer en silence plutôt que renvoyer 409.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_FAILED
  );
}

/**
 * Renvoie l'exception Nest à lever pour une écriture Prisma en échec.
 *
 * - contrainte d'unicité → 409 Conflict avec le message métier fourni
 * - enregistrement absent (update / delete sur un id inexistant) → 404
 * - tout le reste → l'erreur d'origine, inchangée, pour ne pas masquer un vrai
 *   incident derrière un statut rassurant (elle finira en 500, ce qui est juste)
 *
 * S'utilise avec `throw`, ce qui garde le `try/catch` de l'appelant lisible :
 *
 * ```ts
 * try {
 *   return await this.prisma.stack.create({ data });
 * } catch (error) {
 *   throw toWriteException(error, 'Ce slug est déjà utilisé');
 * }
 * ```
 */
export function toWriteException(error: unknown, conflictMessage: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === UNIQUE_CONSTRAINT_FAILED) {
      return new ConflictException(conflictMessage);
    }
    if (error.code === RECORD_NOT_FOUND) {
      return new NotFoundException();
    }
  }

  return error;
}
