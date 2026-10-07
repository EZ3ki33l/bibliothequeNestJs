import type { AdminEntryDifficulty, AdminEntryKind } from '../../lib/admin';
import { todayAsDay, type EntrySourceInput } from '../../lib/entrySources';
import { pairsToRecord, type KeyValuePair } from './keyValuePairs';
import { rowsToSources, type SourceRow } from './sourceRows';

/**
 * Saisie d'une fiche, telle qu'elle sera envoyée à l'API.
 *
 * Même forme que `UpdateAdminEntryInput` (`lib/admin.ts`), mais avec tous les
 * champs présents : c'est `lib/admin.ts` qui décide ensuite quoi envoyer selon
 * le verbe HTTP. `categoryId` n'en fait pas partie : il n'existe qu'à la
 * création et ne s'affiche pas dans une fiche.
 */
export type EntryFormFields = {
  title: string;
  kind: AdminEntryKind;
  summary: string;
  bodyMdx: string;
  difficulty: AdminEntryDifficulty;
  published: boolean;
  template: string;
  tags: string[];
  files: Record<string, string>;
  dependencies: Record<string, string>;
  /** Dans l'ordre des lignes du formulaire. */
  sources: EntrySourceInput[];
  /** `AAAA-MM-JJ`, ou `null` quand le champ est vide (efface la date). */
  verifiedOn: string | null;
  verifiedVersion: string;
};

/**
 * Résultat de la lecture plutôt qu'exception : une liste mal remplie est une
 * erreur de saisie à afficher dans le formulaire, pas une panne.
 */
export type ReadEntryFieldsResult =
  { ok: true; fields: EntryFormFields; categoryId: string } | { ok: false; message: string };

/**
 * Lit la saisie du formulaire de fiche.
 *
 * Le formulaire est **non contrôlé** : la valeur des champs vit dans le DOM et
 * se lit par `FormData`. Seules les listes « fichiers », « dépendances » et
 * « sources » sont dans un état React, d'où leurs trois paramètres.
 *
 * Cette lecture n'existe qu'ici. L'enregistrement et l'aperçu l'appellent tous
 * les deux : mêmes `trim()`, même découpage des étiquettes, mêmes messages
 * d'erreur. Deux lectures séparées finiraient par différer, et l'aperçu
 * montrerait autre chose que ce qui est enregistré.
 *
 * `categoryId` vaut une chaîne vide en modification : le champ n'existe pas.
 */
export function readEntryFields(
  form: HTMLFormElement,
  files: KeyValuePair[],
  dependencies: KeyValuePair[],
  sources: SourceRow[],
): ReadEntryFieldsResult {
  // Validation locale avant tout appel réseau : une paire sans clé est une
  // erreur de saisie, inutile de la faire voyager jusqu'au serveur.
  const filesResult = pairsToRecord(files, 'Chaque fichier doit avoir un chemin.');
  if (!filesResult.ok) {
    return { ok: false, message: filesResult.message };
  }

  const dependenciesResult = pairsToRecord(
    dependencies,
    'Chaque dépendance doit avoir un nom de paquet.',
  );
  if (!dependenciesResult.ok) {
    return { ok: false, message: dependenciesResult.message };
  }

  const today = todayAsDay();

  const sourcesResult = rowsToSources(sources, today);
  if (!sourcesResult.ok) {
    return { ok: false, message: sourcesResult.message };
  }

  const data = new FormData(form);

  // Champ date vide : `null`, qui efface la date côté serveur. La date n'est
  // jamais déduite ni préremplie : elle n'avance que sur saisie.
  const verifiedOn = String(data.get('verifiedOn') ?? '').trim() || null;
  if (verifiedOn !== null && verifiedOn > today) {
    return { ok: false, message: 'La date de vérification est dans le futur.' };
  }

  /**
   * Payload complet, sans tri des champs vides : c'est `lib/admin.ts` qui
   * décide quoi envoyer selon le verbe HTTP (à la création les champs vides
   * sont retirés pour laisser jouer les défauts du serveur ; à la
   * modification ils sont conservés pour pouvoir effacer une valeur).
   */
  const fields: EntryFormFields = {
    title: String(data.get('title') ?? '').trim(),
    kind: String(data.get('kind') ?? '').trim() as AdminEntryKind,
    summary: String(data.get('summary') ?? '').trim(),
    bodyMdx: String(data.get('bodyMdx') ?? '').trim(),
    difficulty: String(data.get('difficulty') ?? '').trim() as AdminEntryDifficulty,
    // Une case cochée envoie `on` ; décochée, elle n'envoie rien.
    published: data.get('published') === 'on',
    template: String(data.get('template') ?? '').trim(),
    // « react, hooks , » → ['react', 'hooks']
    tags: String(data.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    files: filesResult.value,
    dependencies: dependenciesResult.value,
    sources: sourcesResult.value,
    verifiedOn,
    verifiedVersion: String(data.get('verifiedVersion') ?? '').trim(),
  };

  return { ok: true, fields, categoryId: String(data.get('categoryId') ?? '').trim() };
}
