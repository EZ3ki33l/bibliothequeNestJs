import type { EntryDetail, EntryHeader, FullEntry, ReaderEntryResult } from './stacks';
import type { ViewerAccess } from './viewerAccess';

/**
 * Ce que la page d'une fiche doit afficher, déduit des deux lectures du
 * serveur : la lecture publique (`GET /entries/:slug`) et, pour une fiche
 * réservée ouverte par un compte, la lecture complète
 * (`GET /reader/entries/:slug`).
 *
 * La fonction ne décide d'aucun accès : elle traduit en un état d'écran ce que
 * le serveur a **déjà** répondu. `readable` ne peut porter qu'une fiche que le
 * serveur a transmise en entier.
 */
export type EntryReading =
  | { status: 'loading' }
  | { status: 'not-found' }
  /** La fiche se lit en entier : contenu, examen, favori, note, signalement. */
  | { status: 'readable'; entry: FullEntry }
  /**
   * La fiche existe, mais ce lecteur ne peut pas la lire : en-tête et zone
   * floutée. `reader` choisit le message : invitation à créer un compte
   * (`visitor`) ou demande de vérifier l'adresse (`unverified`).
   */
  | { status: 'locked'; header: EntryHeader; reader: 'visitor' | 'unverified' };

/**
 * @param publicEntry lecture publique : `undefined` en cours, `null` introuvable
 * @param viewer lecteur vu par l'écran ; `undefined` tant que la session est en
 *        cours de lecture
 * @param readerEntry lecture complète ; `undefined` tant qu'elle n'est pas
 *        revenue (ou pas demandée)
 */
export function resolveEntryReading(
  publicEntry: EntryDetail | null | undefined,
  viewer: ViewerAccess | undefined,
  readerEntry: ReaderEntryResult | undefined,
): EntryReading {
  if (publicEntry === undefined) return { status: 'loading' };
  if (publicEntry === null) return { status: 'not-found' };
  if (publicEntry.access === 'free') return { status: 'readable', entry: publicEntry };

  // Fiche réservée. Tant que le lecteur est inconnu, la page attend : afficher
  // la zone floutée annoncerait un refus que rien n'a encore établi.
  if (viewer === undefined) return { status: 'loading' };

  // Sans compte, aucune lecture complète n'est tentée.
  if (viewer === 'visitor') return { status: 'locked', header: publicEntry, reader: 'visitor' };

  // Un compte est connecté : c'est la réponse du serveur qui tranche, pas
  // l'état de la session dans le navigateur (qui peut dater).
  if (readerEntry === undefined) return { status: 'loading' };
  if (readerEntry === null) return { status: 'not-found' };
  if (readerEntry === 'forbidden') {
    return { status: 'locked', header: publicEntry, reader: 'unverified' };
  }
  // Session expirée entre-temps : le lecteur est redevenu un visiteur.
  if (readerEntry === 'unauthorized') {
    return { status: 'locked', header: publicEntry, reader: 'visitor' };
  }

  return { status: 'readable', entry: readerEntry };
}
