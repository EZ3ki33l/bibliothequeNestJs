import type { EntryLab } from './stacks';

/**
 * Règles pures des fichiers d'un laboratoire (spec 018).
 *
 * `labPathRefusal` et `labFilesRefusal` sont **la copie** de
 * `backend/src/common/lab-files.ts` : même règle, le serveur reste le contrôle.
 * Ici elles servent au message immédiat du formulaire et au refus de construire
 * une archive dont un chemin sortirait du dossier d'extraction (« zip slip »).
 * Toute modification se fait des deux côtés, dans le même changement.
 */

export const MAX_LAB_FILES = 30;
export const MAX_LAB_FILE_LENGTH = 50_000;
export const MAX_LAB_TOTAL_LENGTH = 200_000;
export const MAX_LAB_PATH_LENGTH = 200;
export const MAX_LAB_PATH_DEPTH = 5;

const ALLOWED_DOTFILES: readonly string[] = [
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
    if (RESERVED.test(part.split('.')[0])) return `« ${part} » est un nom réservé de Windows`;
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

/** Langage de coloration d'un fichier, d'après son nom (research § 8). */
export function labFileLanguage(path: string): string {
  const name = path.split('/').pop() ?? path;
  if (name === 'Vagrantfile') return 'ruby';
  if (name === 'Dockerfile') return 'dockerfile';
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  switch (extension) {
    case 'sh':
      return 'bash';
    case 'ps1':
      return 'powershell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'json':
    case 'gns3':
      return 'json';
    case 'py':
      return 'python';
    case 'conf':
    case 'cfg':
    case 'ini':
      return 'ini';
    default:
      return 'text';
  }
}

/**
 * Bloc de code Markdown dont la clôture est plus longue que toute suite de
 * « ` » du contenu : aucun contenu ne peut fermer le bloc et injecter du
 * Markdown après lui.
 */
export function fencedCode(content: string, language: string): string {
  const runs = content.match(/`+/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${content}\n${fence}`;
}

/** Nœud de l'arbre des fichiers : un dossier (`children`) ou un fichier. */
export type LabTreeNode = {
  name: string;
  path: string;
  /** Présent pour un fichier. */
  content?: string;
  children?: LabTreeNode[];
};

/** Arbre des fichiers : dossiers d'abord, puis ordre alphabétique. */
export function buildFileTree(files: Record<string, string>): LabTreeNode[] {
  const root: LabTreeNode = { name: '', path: '', children: [] };

  for (const path of Object.keys(files).sort()) {
    let node = root;
    const parts = path.split('/');
    parts.forEach((part, index) => {
      const nodePath = parts.slice(0, index + 1).join('/');
      const isFile = index === parts.length - 1;
      let child = node.children?.find((candidate) => candidate.name === part);
      if (!child) {
        child = isFile
          ? { name: part, path: nodePath, content: files[path] }
          : { name: part, path: nodePath, children: [] };
        node.children?.push(child);
      }
      node = child;
    });
  }

  const sort = (nodes: LabTreeNode[]) => {
    nodes.sort((a, b) => {
      const aDir = a.children !== undefined;
      const bDir = b.children !== undefined;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => node.children && sort(node.children));
  };
  sort(root.children ?? []);

  return root.children ?? [];
}

/** Chemins de fichiers dans l'ordre d'affichage de l'arbre (parcours en profondeur). */
export function orderedFilePaths(nodes: LabTreeNode[]): string[] {
  return nodes.flatMap((node) => (node.children ? orderedFilePaths(node.children) : [node.path]));
}

/** Manques d'un laboratoire avant publication (FR-016). Liste vide : rien à signaler. */
export function labGaps(
  lab: Pick<EntryLab, 'files' | 'setupMd' | 'teardownMd' | 'software'> | null,
): string[] {
  if (!lab) return [];
  const gaps: string[] = [];
  if (Object.keys(lab.files).length === 0) gaps.push('Le laboratoire n’a aucun fichier.');
  if (lab.setupMd.trim() === '') gaps.push('Le laboratoire n’a pas d’étapes de lancement.');
  if (lab.teardownMd.trim() === '') {
    gaps.push('Le laboratoire n’a pas d’étapes d’arrêt et de destruction.');
  }
  if (lab.software.trim() === '') gaps.push('Le laboratoire ne précise pas les logiciels requis.');
  return gaps;
}
