import type { AdminEntryDifficulty, AdminEntryKind } from '../../lib/admin';
import { todayAsDay, type EntrySourceInput } from '../../lib/entrySources';
import { labFilesRefusal } from '../../lib/labFiles';
import { isPythonTemplate } from '../../lib/playgroundEnvironments';
import type { EntryLab, LabHost, LabTool } from '../../lib/stacks';
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
  /** Atelier Python : entrée standard et sortie attendue. */
  playgroundInput: string;
  playgroundExpectedOutput: string;
  /** Dans l'ordre des lignes du formulaire. */
  sources: EntrySourceInput[];
  /** `AAAA-MM-JJ`, ou `null` quand le champ est vide (efface la date). */
  verifiedOn: string | null;
  verifiedVersion: string;
  /** `null` : case « Cette fiche a un laboratoire » décochée. */
  lab: EntryLab | null;
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
  labFiles: KeyValuePair[] = [],
): ReadEntryFieldsResult {
  // Validation locale avant tout appel réseau : une paire sans clé est une
  // erreur de saisie, inutile de la faire voyager jusqu'au serveur.
  const filesResult = pairsToRecord(files, 'Chaque fichier doit avoir un chemin.');
  if (!filesResult.ok) {
    return { ok: false, message: filesResult.message };
  }

  const data = new FormData(form);
  const template = String(data.get('template') ?? '').trim();

  // Un atelier Python n'a pas de dépendances (le serveur les refuse) : la liste,
  // masquée dans le formulaire, est envoyée vide et n'est pas contrôlée.
  const dependenciesResult = isPythonTemplate(template)
    ? { ok: true as const, value: {} }
    : pairsToRecord(dependencies, 'Chaque dépendance doit avoir un nom de paquet.');
  if (!dependenciesResult.ok) {
    return { ok: false, message: dependenciesResult.message };
  }

  const today = todayAsDay();

  const sourcesResult = rowsToSources(sources, today);
  if (!sourcesResult.ok) {
    return { ok: false, message: sourcesResult.message };
  }

  // Champ date vide : `null`, qui efface la date côté serveur. La date n'est
  // jamais déduite ni préremplie : elle n'avance que sur saisie.
  const verifiedOn = String(data.get('verifiedOn') ?? '').trim() || null;
  if (verifiedOn !== null && verifiedOn > today) {
    return { ok: false, message: 'La date de vérification est dans le futur.' };
  }

  // Laboratoire (spec 018) : décoché, rien n'est lu ni contrôlé (les champs
  // restent dans le DOM, cachés). Coché, une erreur de saisie s'affiche ici.
  const labResult = readLab(data, labFiles);
  if (!labResult.ok) {
    return { ok: false, message: labResult.message };
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
    template,
    // « react, hooks , » → ['react', 'hooks']
    tags: String(data.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    files: filesResult.value,
    dependencies: dependenciesResult.value,
    // Fin seulement : les espaces intérieurs et en début de ligne comptent.
    playgroundInput: String(data.get('playgroundInput') ?? '').trimEnd(),
    playgroundExpectedOutput: String(data.get('playgroundExpectedOutput') ?? '').trimEnd(),
    sources: sourcesResult.value,
    verifiedOn,
    verifiedVersion: String(data.get('verifiedVersion') ?? '').trim(),
    lab: labResult.value,
  };

  return { ok: true, fields, categoryId: String(data.get('categoryId') ?? '').trim() };
}

const LAB_TOOLS: readonly LabTool[] = [
  'VAGRANT',
  'DOCKER_COMPOSE',
  'CONTAINERLAB',
  'GNS3',
  'OTHER',
];
const LAB_HOSTS: readonly LabHost[] = ['LINUX', 'WINDOWS', 'MACOS'];

/** Entier de `min` à `max`, ou `null` (une chaîne vide n'est pas 0). */
function boundedInt(raw: unknown, min: number, max: number): number | null {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

/**
 * Lit le bloc « Laboratoire ». Mêmes bornes que `EntryLabDto` : le message
 * immédiat évite un aller-retour, le serveur reste le contrôle.
 */
function readLab(
  data: FormData,
  labFiles: KeyValuePair[],
): { ok: true; value: EntryLab | null } | { ok: false; message: string } {
  if (data.get('labEnabled') !== 'on') {
    return { ok: true, value: null };
  }

  const tool = String(data.get('labTool') ?? '');
  if (!LAB_TOOLS.includes(tool as LabTool)) {
    return { ok: false, message: 'Le laboratoire demande un outil.' };
  }

  const ramGb = boundedInt(data.get('labRamGb'), 1, 128);
  if (ramGb === null) {
    return {
      ok: false,
      message: 'La mémoire du laboratoire doit être un nombre de Go entre 1 et 128.',
    };
  }
  const diskGb = boundedInt(data.get('labDiskGb'), 1, 500);
  if (diskGb === null) {
    return {
      ok: false,
      message: 'Le disque du laboratoire doit être un nombre de Go entre 1 et 500.',
    };
  }

  const hosts = data
    .getAll('labHost')
    .map(String)
    .filter((host): host is LabHost => LAB_HOSTS.includes(host as LabHost));
  if (hosts.length === 0) {
    return { ok: false, message: 'Le laboratoire demande au moins un système hôte.' };
  }

  const software = String(data.get('labSoftware') ?? '').trim();
  if (software.length > 300) {
    return { ok: false, message: 'Les logiciels requis dépassent 300 caractères.' };
  }
  const setupMd = String(data.get('labSetupMd') ?? '').trimEnd();
  if (setupMd.length > 5000) {
    return { ok: false, message: 'Les étapes de lancement dépassent 5 000 caractères.' };
  }
  const teardownMd = String(data.get('labTeardownMd') ?? '').trimEnd();
  if (teardownMd.length > 3000) {
    return { ok: false, message: 'Les étapes d’arrêt dépassent 3 000 caractères.' };
  }

  const filesResult = pairsToRecord(
    labFiles,
    'Chaque fichier du laboratoire doit avoir un chemin.',
  );
  if (!filesResult.ok) {
    return { ok: false, message: filesResult.message };
  }
  const refusal = labFilesRefusal(filesResult.value);
  if (refusal) {
    return { ok: false, message: refusal };
  }

  return {
    ok: true,
    value: {
      tool: tool as LabTool,
      securityLab: data.get('labSecurity') === 'on',
      software,
      ramGb,
      diskGb,
      hosts,
      setupMd,
      teardownMd,
      files: filesResult.value,
    },
  };
}
