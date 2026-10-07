import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Jour de calendrier, sans heure : `AAAA-MM-JJ`.
 *
 * « Vérifié le 6 octobre » ne porte pas d'heure. Un horodatage complet
 * s'afficherait le 5 ou le 7 selon le fuseau du lecteur ; une chaîne
 * `AAAA-MM-JJ` désigne le même jour partout, et deux jours se comparent par
 * simple ordre alphabétique.
 *
 * Les fonctions sont **pures** : `now` est un paramètre, donc un test fixe
 * l'instant au lieu de dépendre de l'horloge.
 */

/**
 * Fuseau dans lequel « aujourd'hui » est calculé.
 *
 * Le serveur tourne en UTC. Entre minuit et deux heures du matin à Paris, il
 * est encore la veille en UTC : sans fuseau fixé, la date du jour saisie par le
 * rédacteur serait refusée comme future.
 */
export const EDITORIAL_TIME_ZONE = 'Europe/Paris';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `en-CA` est la locale dont le format de date court est `AAAA-MM-JJ`.
 * L'objet est créé une fois : le construire à chaque appel est coûteux.
 */
const DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: EDITORIAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `AAAA-MM-JJ` du jour courant dans le fuseau éditorial. */
export function todayAsDay(now: Date = new Date()): string {
  return DAY_FORMATTER.format(now);
}

/** `AAAA-MM-JJ` → `Date` à minuit UTC : la valeur attendue par une colonne `DATE`. */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** `Date` lue dans une colonne `DATE` (minuit UTC) → `AAAA-MM-JJ`. */
export function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Vrai si `value` est un jour qui existe, écrit `AAAA-MM-JJ`.
 *
 * Le format ne suffit pas : `2026-02-30` le respecte. `Date` le décale au
 * 2 mars au lieu de le refuser, d'où l'aller-retour : un jour réel se relit à
 * l'identique.
 */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) {
    return false;
  }

  const date = dayToDate(value);

  return !Number.isNaN(date.getTime()) && dateToDay(date) === value;
}

/** Vrai si `day` est strictement après aujourd'hui (fuseau éditorial). */
export function isFutureDay(day: string, now: Date = new Date()): boolean {
  return day > todayAsDay(now);
}

/**
 * Décorateur de validation : le champ est un jour de calendrier réel, qui
 * n'est pas dans le futur.
 *
 * Un **décorateur de validation** est une annotation posée sur un champ de
 * DTO ; le `ValidationPipe` l'exécute comme `@IsString()`. `registerDecorator`
 * en déclare un nouveau. La règle elle-même reste dans les deux fonctions
 * ci-dessus, testables sans framework.
 *
 * Une valeur absente n'arrive pas jusqu'ici quand le champ porte
 * `@IsOptional()`.
 */
export function IsPastOrPresentDay(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isPastOrPresentDay',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate: (value: unknown) => isCalendarDay(value) && !isFutureDay(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'la date'} doit être une date AAAA-MM-JJ qui n'est pas dans le futur`,
      },
    });
  };
}
