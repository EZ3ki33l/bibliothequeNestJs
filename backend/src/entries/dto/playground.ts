import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Règles du playground d'une fiche (`template`, `files`, `dependencies`) et
 * des étiquettes, partagées par `CreateEntryDto` et `UpdateEntryDto`.
 *
 * `files` et `dependencies` sont des colonnes `Json` : sans contrôle, un objet
 * imbriqué ou un nombre y serait enregistré tel quel, puis relu par le site et
 * par l'application mobile. `@IsObject()` ne regarde que le contenant ; le
 * décorateur ci-dessous regarde aussi chaque clé et chaque valeur.
 */

/**
 * Modèles Sandpack acceptés : la même liste que le `<select>` du formulaire
 * (`frontend/src/lib/sandpack.ts`). Une valeur hors liste ne lancerait aucun
 * atelier : le site retomberait silencieusement sur `react-ts`.
 */
export const SANDPACK_TEMPLATES = [
  'static',
  'angular',
  'react',
  'react-ts',
  'solid',
  'svelte',
  'vanilla',
  'vanilla-ts',
  'vue',
  'vue-ts',
  'node',
  'nextjs',
  'vite',
  'vite-react',
  'vite-react-ts',
] as const;

/**
 * Environnements acceptés pour `template` : les modèles Sandpack, plus
 * `python` (atelier Python exécuté dans le navigateur, spec 017).
 */
export const PLAYGROUND_TEMPLATES = [...SANDPACK_TEMPLATES, 'python'] as const;

/** Entrée standard et sortie attendue de l'atelier Python : 10 000 caractères chacune. */
export const MAX_PLAYGROUND_TEXT_LENGTH = 10_000;

/** Fichiers du playground : chemin → code. */
export const PLAYGROUND_FILES_LIMITS = {
  maxEntries: 20,
  maxKeyLength: 200,
  maxValueLength: 20_000,
};

/** Dépendances du playground : paquet npm → version (214 = longueur maximale d'un nom npm). */
export const PLAYGROUND_DEPENDENCIES_LIMITS = {
  maxEntries: 30,
  maxKeyLength: 214,
  maxValueLength: 50,
};

/** Étiquettes : 50 caractères, comme le filtre `?tag=` de `GET /entries` (une étiquette plus longue ne se retrouverait jamais). */
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;

type StringRecordLimits = {
  maxEntries: number;
  maxKeyLength: number;
  maxValueLength: number;
};

/** Vrai pour un objet simple dont chaque clé est non vide et chaque valeur est un texte, dans les bornes. */
export function isStringRecord(value: unknown, limits: StringRecordLimits): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value);
  if (entries.length > limits.maxEntries) {
    return false;
  }

  return entries.every(
    ([key, val]) =>
      key.trim().length > 0 &&
      key.length <= limits.maxKeyLength &&
      typeof val === 'string' &&
      val.length <= limits.maxValueLength,
  );
}

/**
 * Décorateur `class-validator` : l'objet reçu est un dictionnaire texte → texte
 * borné (voir `isStringRecord`).
 */
export function IsStringRecord(
  limits: StringRecordLimits,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isStringRecord',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate: (value: unknown) => isStringRecord(value, limits),
        defaultMessage: (args) =>
          `${args?.property ?? 'le champ'} doit associer au plus ${limits.maxEntries} noms non vides ` +
          `(${limits.maxKeyLength} caractères au plus) à des textes de ${limits.maxValueLength} caractères au plus`,
      },
    });
  };
}
