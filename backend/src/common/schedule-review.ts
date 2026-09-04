import { ReviewRating } from '../generated/prisma/enums';

/** Ce que la carte sait de son passé avant la révision. */
export type ScheduleReviewCard = {
  /** « Facilité » de la carte : plus elle est haute, plus les délais s'allongent. */
  easeFactor: number;
  /** Délai utilisé pour la révision précédente, en jours. */
  intervalDays: number;
  /** Nombre de révisions réussies d'affilée (0 = jamais réussie). */
  repetitions: number;
};

export type ScheduleReviewResult = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
  lastReviewedAt: Date;
};

/**
 * Facilité minimale.
 *
 * Sans ce plancher, une carte ratée plusieurs fois verrait sa facilité tomber
 * si bas que ses délais n'augmenteraient plus jamais : elle reviendrait
 * indéfiniment tous les jours.
 */
const MIN_EASE = 1.3;

/** Une réponse ratée rend la carte un peu « plus difficile » pour la suite. */
const EASE_PENALTY_AGAIN = 0.2;
const EASE_PENALTY_HARD = 0.15;
/** Une réponse facile l'éloigne davantage la prochaine fois. */
const EASE_BONUS_EASY = 0.15;

/**
 * Délais de la toute première réussite, en jours : « difficile » revient dès
 * demain, « bien » dans trois jours, « facile » dans une semaine.
 */
const FIRST_INTERVAL_HARD = 1;
const FIRST_INTERVAL_GOOD = 3;
const FIRST_INTERVAL_EASY = 7;

/** Un « difficile » n'allonge le délai que de 20 %. */
const HARD_INTERVAL_GROWTH = 1.2;
/** Un « facile » ajoute 30 % au-dessus de la facilité de la carte. */
const EASY_INTERVAL_BONUS = 1.3;

function addDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Décide quand une fiche devra être revue (algorithme SM-2, simplifié).
 *
 * L'idée : ce qu'on retient bien peut attendre, ce qu'on oublie doit revenir
 * vite. Chaque carte garde donc un délai et une « facilité » ; la note donnée
 * par l'utilisateur les fait évoluer.
 *
 * Ce que garantit la fonction, quelle que soit la carte :
 * - « Encore » → à revoir tout de suite (délai remis à zéro) ;
 * - sinon, « difficile » revient avant « bien », qui revient avant « facile ».
 *
 * Fonction **pure** : elle reçoit l'heure courante (`now`) au lieu d'appeler
 * `new Date()`. C'est ce qui rend le calendrier testable — un test peut fixer
 * une date et vérifier le résultat exactement.
 */
export function scheduleReview(
  card: ScheduleReviewCard,
  rating: ReviewRating,
  now: Date,
): ScheduleReviewResult {
  const lastReviewedAt = new Date(now.getTime());

  // « Encore » : la fiche n'est pas sue. Elle repart de zéro et redevient due
  // immédiatement, donc elle réapparaîtra dans la session en cours.
  if (rating === ReviewRating.AGAIN) {
    return {
      easeFactor: Math.max(MIN_EASE, card.easeFactor - EASE_PENALTY_AGAIN),
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: new Date(now.getTime()),
      lastReviewedAt,
    };
  }

  // Première réussite : il n'y a pas d'ancien délai à faire grandir, on part
  // donc d'un délai fixe choisi selon la note.
  if (card.repetitions === 0) {
    if (rating === ReviewRating.HARD) {
      return {
        easeFactor: Math.max(MIN_EASE, card.easeFactor - EASE_PENALTY_HARD),
        intervalDays: FIRST_INTERVAL_HARD,
        repetitions: 1,
        nextReviewAt: addDays(now, FIRST_INTERVAL_HARD),
        lastReviewedAt,
      };
    }

    if (rating === ReviewRating.GOOD) {
      return {
        easeFactor: card.easeFactor,
        intervalDays: FIRST_INTERVAL_GOOD,
        repetitions: 1,
        nextReviewAt: addDays(now, FIRST_INTERVAL_GOOD),
        lastReviewedAt,
      };
    }

    return {
      easeFactor: card.easeFactor + EASE_BONUS_EASY,
      intervalDays: FIRST_INTERVAL_EASY,
      repetitions: 1,
      nextReviewAt: addDays(now, FIRST_INTERVAL_EASY),
      lastReviewedAt,
    };
  }

  // Révisions suivantes : le nouveau délai part de l'ancien.
  // `Math.max(1, …)` empêche un délai de 0 jour, qui ferait revenir la fiche
  // dans la même session alors qu'elle a été réussie.

  // « Difficile » : réussi, mais péniblement. Le délai avance peu.
  if (rating === ReviewRating.HARD) {
    const intervalDays = Math.max(1, Math.round(card.intervalDays * HARD_INTERVAL_GROWTH));

    return {
      easeFactor: Math.max(MIN_EASE, card.easeFactor - EASE_PENALTY_HARD),
      intervalDays,
      // Les répétitions ne progressent pas : la carte n'est pas mieux sue.
      repetitions: card.repetitions,
      nextReviewAt: addDays(now, intervalDays),
      lastReviewedAt,
    };
  }

  // « Bien » : le délai est multiplié par la facilité de la carte. Avec une
  // facilité de 2,5, trois jours deviennent huit.
  if (rating === ReviewRating.GOOD) {
    const intervalDays = Math.max(1, Math.round(card.intervalDays * card.easeFactor));

    return {
      easeFactor: card.easeFactor,
      intervalDays,
      repetitions: card.repetitions,
      nextReviewAt: addDays(now, intervalDays),
      lastReviewedAt,
    };
  }

  // « Facile » : la facilité augmente, et le délai est majoré de 30 % par-dessus.
  const easeFactor = card.easeFactor + EASE_BONUS_EASY;
  const intervalDays = Math.max(
    // Au moins un jour de plus que la dernière fois : « facile » doit toujours
    // éloigner la carte, même quand l'ancien délai était très court.
    card.intervalDays + 1,
    Math.round(card.intervalDays * easeFactor * EASY_INTERVAL_BONUS),
  );

  return {
    easeFactor,
    intervalDays,
    repetitions: card.repetitions,
    nextReviewAt: addDays(now, intervalDays),
    lastReviewedAt,
  };
}
