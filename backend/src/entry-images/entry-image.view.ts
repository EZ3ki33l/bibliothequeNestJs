import type { Prisma } from '../generated/prisma/client';

/**
 * Colonnes d'une image lues pour répondre à l'API (spec 016, data-model).
 *
 * Les clés chez le prestataire (`readingKey`, `fullKey`) et le compte qui l'a
 * envoyée n'y figurent **jamais** : un `select` explicite plutôt qu'une ligne
 * entière, comme `ENTRY_CARD_SELECT`.
 */
export const ENTRY_IMAGE_SELECT = {
  id: true,
  alt: true,
  caption: true,
  readingWidth: true,
  readingHeight: true,
  readingBytes: true,
  fullWidth: true,
  fullHeight: true,
  fullBytes: true,
  createdAt: true,
} satisfies Prisma.EntryImageSelect;

/** Images d'une fiche dans l'ordre d'envoi, pour une lecture de fiche. */
export const ENTRY_IMAGES_IN_ORDER = {
  orderBy: { createdAt: 'asc' },
  select: ENTRY_IMAGE_SELECT,
} satisfies Prisma.EntryImageFindManyArgs;

export type EntryImageRow = Prisma.EntryImageGetPayload<{ select: typeof ENTRY_IMAGE_SELECT }>;

/** Forme publique (`EntryImagePublic` du contrat) : `width`/`height` = version de lecture. */
export function toPublicImage(row: EntryImageRow) {
  return {
    id: row.id,
    alt: row.alt,
    caption: row.caption,
    width: row.readingWidth,
    height: row.readingHeight,
    fullWidth: row.fullWidth,
    fullHeight: row.fullHeight,
  };
}

/** Forme de l'administration (`EntryImageAdmin`) : la forme publique, plus les poids et la date. */
export function toAdminImage(row: EntryImageRow) {
  return {
    ...toPublicImage(row),
    readingBytes: row.readingBytes,
    fullBytes: row.fullBytes,
    createdAt: row.createdAt,
  };
}

/**
 * Référence Markdown prête à insérer dans le corps : `![alt](/media/<id>)`.
 *
 * Le texte alternatif est échappé (`\`, `[`, `]`) et mis sur une ligne : une
 * saisie ne peut pas fermer la référence ni en ouvrir une autre.
 */
export function markdownReference(id: string, alt: string): string {
  const safeAlt = alt.replace(/\s+/g, ' ').replace(/([\\[\]])/g, '\\$1');
  return `![${safeAlt}](/media/${id})`;
}
