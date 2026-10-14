import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Fichiers d'un laboratoire (spec 018) : chemin relatif → contenu texte.
 *
 * Le laboratoire est extrait sur la machine de l'apprenant. Un chemin
 * `../../.bashrc` ou `C:\Windows\…` écrirait hors du dossier d'extraction
 * (« zip slip », OWASP A08) ; une liste d'**autorisation** de caractères ferme
 * d'un coup les variantes Unicode. La même règle est copiée dans
 * `frontend/src/lib/labFiles.ts` : toute modification se fait des deux côtés,
 * le serveur reste le contrôle.
 */

export const MAX_LAB_FILES = 30;
export const MAX_LAB_FILE_LENGTH = 50_000;
export const MAX_LAB_TOTAL_LENGTH = 200_000;
export const MAX_LAB_PATH_LENGTH = 200;
/** 4 dossiers + le fichier. */
export const MAX_LAB_PATH_DEPTH = 5;

/** Seuls fichiers cachés admis (un composant commençant par « . » est refusé sinon). */
export const ALLOWED_DOTFILES: readonly string[] = [
  '.env.example',
  '.gitignore',
  '.vagrant-version',
  '.editorconfig',
];

const COMPONENT = /^[A-Za-z0-9._-]{1,64}$/;
const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Raison du refus d'un chemin, ou `null` s'il est sûr. */
export function labPathRefusal(path: string): string | null {
  if (path.length === 0) return 'le chemin est vide';
  if (path.length > MAX_LAB_PATH_LENGTH) {
    return `le chemin dépasse ${MAX_LAB_PATH_LENGTH} caractères`;
  }
  if (CONTROL.test(path)) return 'le chemin contient un caractère de contrôle';
  if (path.startsWith('/')) return 'le chemin doit être relatif';
  if (path.includes('\\')) return 'le séparateur « \\ » est interdit';
  if (path.includes(':')) return 'le caractère « : » est interdit';

  const parts = path.split('/');
  if (parts.length > MAX_LAB_PATH_DEPTH) {
    return `le chemin dépasse ${MAX_LAB_PATH_DEPTH} niveaux`;
  }

  for (const part of parts) {
    if (part === '') return 'le chemin contient un composant vide';
    if (part === '.' || part === '..') return 'les composants « . » et « .. » sont interdits';
    if (!COMPONENT.test(part)) {
      return 'seuls les lettres, chiffres, « . », « _ » et « - » sont admis (64 caractères au plus par composant)';
    }
    if (part.endsWith('.')) return 'un composant ne peut pas finir par un point';
    if (RESERVED.test(part.split('.')[0])) {
      return `« ${part} » est un nom réservé de Windows`;
    }
    if (part.startsWith('.') && !ALLOWED_DOTFILES.includes(part)) {
      return `le fichier caché « ${part} » n'est pas admis`;
    }
  }

  return null;
}

/** Raison du refus de l'ensemble, ou `null`. Le message nomme le fichier fautif. */
export function labFilesRefusal(files: unknown): string | null {
  if (typeof files !== 'object' || files === null || Array.isArray(files)) {
    return 'les fichiers doivent former un objet chemin → contenu';
  }

  const entries = Object.entries(files);
  if (entries.length > MAX_LAB_FILES) {
    return `un laboratoire compte ${MAX_LAB_FILES} fichiers au plus`;
  }

  let total = 0;
  const seen = new Set<string>();
  const lowered = entries.map(([path]) => path.toLowerCase());

  for (const [path, content] of entries) {
    const refusal = labPathRefusal(path);
    if (refusal) return `Fichier « ${path} » : ${refusal}.`;

    if (typeof content !== 'string') {
      return `Fichier « ${path} » : le contenu doit être du texte.`;
    }
    if (content.length > MAX_LAB_FILE_LENGTH) {
      return `Fichier « ${path} » : le contenu dépasse ${MAX_LAB_FILE_LENGTH} caractères.`;
    }
    if (content.includes('\u0000')) {
      return `Fichier « ${path} » : le contenu contient un caractère nul.`;
    }

    total += content.length;

    const key = path.toLowerCase();
    if (seen.has(key)) {
      return `Fichier « ${path} » : un autre fichier porte le même nom à la casse près.`;
    }
    seen.add(key);

    if (lowered.some((other) => other.startsWith(`${key}/`))) {
      return `Fichier « ${path} » : ce chemin est aussi un dossier.`;
    }
  }

  if (total > MAX_LAB_TOTAL_LENGTH) {
    return `le total des contenus dépasse ${MAX_LAB_TOTAL_LENGTH} caractères`;
  }

  return null;
}

/** Décorateur de validation : `files` passe `labFilesRefusal`. */
export function IsLabFiles(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isLabFiles',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate: (value: unknown) => labFilesRefusal(value) === null,
        defaultMessage: (args) => {
          const refusal = labFilesRefusal(args?.value);
          return refusal ?? 'fichiers invalides';
        },
      },
    });
  };
}
