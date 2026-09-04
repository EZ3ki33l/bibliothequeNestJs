import { apiFetch } from './api';

/**
 * Types du catalogue public et appels correspondants à l'API Nest.
 *
 * Ces types décrivent ce que le serveur **renvoie** : ils reflètent les `select`
 * Prisma des contrôleurs publics. Ils ne sont pas vérifiés à l'exécution, ils ne
 * remplacent donc pas la validation côté serveur ; ils servent à ce que le
 * compilateur nous prévienne quand une page lit un champ qui n'existe pas.
 */

export type StackListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Prisma renvoie les agrégats sous `_count` : ici, le nombre de catégories. */
  _count: { categories: number };
};

export type EntryKind = 'FUNCTION' | 'COMPONENT' | 'CONCEPT';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

/** Fiche telle qu'affichée dans une liste : pas de contenu, pas de quiz. */
export type StackEntry = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  kind: EntryKind;
  difficulty: Difficulty;
  tags: string[];
};

export type StackCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  entries: StackEntry[];
};

export type StackDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categories: StackCategory[];
};

export type CategoryDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  stack: {
    id: string;
    name: string;
    slug: string;
  };
  entries: StackEntry[];
};

/** Fichiers Sandpack : chemin (`/App.tsx`) vers contenu. */
export type SandpackFiles = Record<string, string>;

export type EntryDetail = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  bodyMdx: string;
  kind: EntryKind;
  difficulty: Difficulty;
  tags: string[];
  category: {
    id: string;
    name: string;
    slug: string;
    stack: {
      id: string;
      name: string;
      slug: string;
    };
  };
  template: string;
  files: SandpackFiles | null;
  dependencies: SandpackFiles | null;
};

/**
 * Convertit une valeur JSON quelconque en dictionnaire de chaînes.
 *
 * Les colonnes `files` et `dependencies` sont de type `Json` en base : elles
 * peuvent contenir n'importe quoi. Avant de les passer à Sandpack, on ne garde
 * que les entrées dont la valeur est bien une chaîne, et on renvoie `undefined`
 * s'il ne reste rien — ce qui laisse les valeurs par défaut s'appliquer plutôt
 * que d'afficher un éditeur vide.
 */
export function jsonToStringRecord(value: unknown): SandpackFiles | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record: SandpackFiles = {};

  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'string') record[key] = val;
  }

  return Object.keys(record).length > 0 ? record : undefined;
}

/**
 * Lecture publique renvoyant toujours une valeur.
 *
 * Toute réponse non-2xx lève : c'est `useAsyncData` qui attrapera l'erreur et
 * affichera le message d'échec de la page.
 */
async function read<T>(path: string, errorMessage: string): Promise<T> {
  const response = await apiFetch(path);

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

/**
 * Lecture publique d'une ressource qui peut ne pas exister.
 *
 * Le 404 est un cas normal, pas une panne : on le traduit en `null` pour que la
 * page affiche « introuvable » au lieu d'un message d'erreur technique. Les
 * autres statuts lèvent.
 */
async function readOrNull<T>(path: string, errorMessage: string): Promise<T | null> {
  const response = await apiFetch(path);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export function listStacks(): Promise<StackListItem[]> {
  return read<StackListItem[]>('/stacks', 'Impossible de charger les stacks');
}

export function getStackBySlug(slug: string): Promise<StackDetail | null> {
  return readOrNull<StackDetail>(`/stacks/${slug}`, 'Impossible de charger le stack');
}

/**
 * L'URL de l'API (`/stacks/:stackSlug/categories/:categorySlug`) est plus
 * explicite que celle du navigateur (`/stacks/:stackSlug/:categorySlug`) : un
 * slug de catégorie n'est unique que dans son stack, il faut donc les deux.
 */
export function getCategoryBySlugs(
  stackSlug: string,
  categorySlug: string,
): Promise<CategoryDetail | null> {
  return readOrNull<CategoryDetail>(
    `/stacks/${stackSlug}/categories/${categorySlug}`,
    'Impossible de charger la catégorie',
  );
}

/** Le slug d'une fiche est unique dans tout le catalogue : il suffit seul. */
export function getEntryBySlug(slug: string): Promise<EntryDetail | null> {
  return readOrNull<EntryDetail>(`/entries/${slug}`, 'Impossible de charger la fiche');
}
