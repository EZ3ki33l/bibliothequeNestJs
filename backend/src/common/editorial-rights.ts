import { ForbiddenException } from '@nestjs/common';
import { AdminRole } from '../generated/prisma/enums';

/**
 * Droits éditoriaux des deux rôles d'administration.
 *
 * - `ADMIN` : rédige. Il crée, modifie et supprime des **brouillons**, et rien
 *   d'autre : il ne publie pas, et un contenu publié lui est en lecture seule.
 * - `SUPER_ADMIN` : tous les droits, contenu publié compris. C'est lui qui met
 *   en ligne, après relecture.
 *
 * Interdire seulement la suppression d'un contenu publié ne suffirait pas : un
 * `ADMIN` pourrait le dépublier puis le supprimer. D'où le verrou complet.
 *
 * Les services appellent ces fonctions **avant** d'écrire ; le refus est un 403
 * (« je sais qui tu es, et ce n'est pas permis »), jamais un 404 : un `ADMIN`
 * lit déjà tout le contenu, l'existence n'a rien de secret pour lui.
 */

export const PUBLISH_RESERVED = 'La publication est réservée au super administrateur';
export const PUBLISHED_LOCKED =
  'Un contenu publié ne peut être modifié ou supprimé que par le super administrateur';

/** Vrai si le rôle peut publier et toucher à un contenu déjà publié. */
export function canManagePublished(role: AdminRole): boolean {
  return role === AdminRole.SUPER_ADMIN;
}

/**
 * Refuse la mise en ligne à un `ADMIN`.
 *
 * Seul `published: true` est une demande de publication : `false` ou un champ
 * absent laissent le contenu en brouillon, ce que tout rôle peut faire.
 */
export function assertCanPublish(role: AdminRole, requested: boolean | undefined): void {
  if (requested === true && !canManagePublished(role)) {
    throw new ForbiddenException(PUBLISH_RESERVED);
  }
}

/**
 * Refuse à un `ADMIN` l'écriture sur un contenu publié.
 *
 * `message` permet de préciser le refus quand le contenu n'a pas lui-même de
 * drapeau `published` (un stack ou une catégorie qui contient des fiches
 * publiées).
 */
export function assertUnlocked(
  role: AdminRole,
  isPublished: boolean,
  message: string = PUBLISHED_LOCKED,
): void {
  if (isPublished && !canManagePublished(role)) {
    throw new ForbiddenException(message);
  }
}
