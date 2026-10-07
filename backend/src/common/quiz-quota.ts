/**
 * Plafond des examens démarrés par un compte.
 *
 * Chaque démarrage fait générer un questionnaire par un modèle de langage : un
 * appel payant. Sans plafond, un compte (ou un script qui en tient la session)
 * pourrait enchaîner les « Recommencer » et épuiser le quota du fournisseur.
 *
 * Le compteur est **par compte**, pas par adresse IP : derrière un même routeur,
 * plusieurs apprenants partageraient le quota, et un compte qui change
 * d'adresse y échapperait. Rien n'est stocké en plus : la base connaît déjà
 * les tentatives et leur date de création.
 *
 * Fonction pure : l'heure est reçue en paramètre, ce qui permet de tester la
 * fenêtre sans attendre une heure.
 */

/** Nombre d'examens qu'un compte peut démarrer par fenêtre. */
export const MAX_QUIZ_STARTS_PER_HOUR = 10;

/** Durée de la fenêtre glissante. */
export const QUIZ_QUOTA_WINDOW_MS = 60 * 60 * 1000;

/**
 * Instant à partir duquel un nouvel examen pourra démarrer, ou `null` si le
 * compte est sous le plafond.
 *
 * `startedAt` : dates de création des tentatives du compte, dans un ordre
 * quelconque. Celles qui sont sorties de la fenêtre sont ignorées.
 *
 * La fenêtre est glissante : une place se libère quand la plus ancienne des
 * dix dernières tentatives a plus d'une heure. C'est cet instant qui est
 * renvoyé, pour que l'écran dise quand réessayer au lieu d'un vague « plus tard ».
 */
export function quizRetryAt(startedAt: Date[], now: Date): Date | null {
  const windowStart = now.getTime() - QUIZ_QUOTA_WINDOW_MS;

  const inWindow = startedAt
    .map((date) => date.getTime())
    .filter((time) => time > windowStart)
    .sort((a, b) => a - b);

  if (inWindow.length < MAX_QUIZ_STARTS_PER_HOUR) {
    return null;
  }

  // Avec exactement dix tentatives, c'est la plus ancienne. Au-delà (deux
  // démarrages simultanés ont pu passer ensemble), c'est celle dont la sortie
  // ramène le compte sous le plafond.
  const blocking = inWindow[inWindow.length - MAX_QUIZ_STARTS_PER_HOUR];

  return new Date(blocking + QUIZ_QUOTA_WINDOW_MS);
}
