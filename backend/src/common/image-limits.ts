/**
 * Plafonds des illustrations d'une fiche (spec 016), écrits une seule fois.
 *
 * Le service des images et ses tests les lisent ici ; les messages d'erreur
 * les citent. Changer un seuil se fait ici, par un déploiement : aucune
 * variable d'environnement n'en dépend.
 */

/** Taille maximale du fichier envoyé. Il transite en mémoire et n'est jamais conservé. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Nombre maximal de pixels du fichier envoyé (largeur × hauteur), lu dans son
 * en-tête avant tout décodage : une petite image peut annoncer des dimensions
 * énormes et faire exploser la mémoire au décodage (« bombe de décompression »).
 * 50 millions couvre une photo de téléphone de 48 mégapixels.
 */
export const MAX_INPUT_PIXELS = 50_000_000;

/** Version de lecture, affichée dans la fiche : largeur et poids maximaux. */
export const READING_MAX_WIDTH = 1600;
export const READING_MAX_BYTES = 400 * 1024;

/** Version pleine, ouverte à la demande : plus grand côté et poids maximaux. */
export const FULL_MAX_SIDE = 3840;
export const FULL_MAX_BYTES = 2 * 1024 * 1024;

/** Nombre maximal d'images par fiche. */
export const MAX_IMAGES_PER_ENTRY = 20;

/** Nombre d'images qu'un compte peut envoyer par fenêtre d'une heure. */
export const MAX_IMAGE_UPLOADS_PER_HOUR = 60;

/** Durée de la fenêtre glissante des envois. */
export const IMAGE_UPLOAD_WINDOW_MS = 60 * 60 * 1000;

/**
 * Volume total autorisé chez le prestataire : 90 % de l'offre gratuite de
 * 2 Go. La marge absorbe deux envois simultanés qui passeraient le contrôle
 * ensemble, sans verrou.
 */
export const STORAGE_LIMIT_BYTES = 1_800_000_000;

/**
 * Instant à partir duquel le compte pourra envoyer une nouvelle image, ou
 * `null` s'il est sous le plafond. Même contrat que `quizRetryAt`
 * (`quiz-quota.ts`) : fenêtre glissante, l'instant renvoyé est celui où une
 * place se libère.
 *
 * Fonction pure : l'heure est reçue en paramètre.
 */
export function uploadRetryAt(uploadedAt: Date[], now: Date): Date | null {
  const windowStart = now.getTime() - IMAGE_UPLOAD_WINDOW_MS;

  const inWindow = uploadedAt
    .map((date) => date.getTime())
    .filter((time) => time > windowStart)
    .sort((a, b) => a - b);

  if (inWindow.length < MAX_IMAGE_UPLOADS_PER_HOUR) {
    return null;
  }

  const blocking = inWindow[inWindow.length - MAX_IMAGE_UPLOADS_PER_HOUR];

  return new Date(blocking + IMAGE_UPLOAD_WINDOW_MS);
}

/**
 * Fichiers présents chez le prestataire qui ne correspondent à aucune image
 * en base : restes d'un retrait qui a échoué. `pnpm images:reconcile` les
 * affiche, et les retire avec `--apply`.
 */
export function orphanKeys(remote: readonly string[], known: ReadonlySet<string>): string[] {
  return remote.filter((key) => !known.has(key));
}
