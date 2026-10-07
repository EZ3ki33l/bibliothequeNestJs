import { apiFetch } from './api';
import type { EntrySource } from './entrySources';

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

/**
 * En-tête d'une fiche : ce que le serveur transmet à **tout le monde**, y
 * compris pour une fiche réservée. Ce sont les colonnes d'une carte de liste,
 * plus le rattachement à une leçon et à une catégorie.
 */
export type EntryHeader = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
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
};

/** Fiche entière : l'en-tête, plus le contenu. */
export type FullEntry = EntryHeader & {
  bodyMdx: string;
  template: string;
  files: SandpackFiles | null;
  dependencies: SandpackFiles | null;
  /** Documents d'origine, dans l'ordre saisi. Tableau vide : aucune source. */
  sources: EntrySource[];
  /** Jour de la dernière vérification, `AAAA-MM-JJ`. Saisi par l'administration. */
  verifiedOn: string | null;
  /** Version vérifiée (« React 19 »). Chaîne vide : non renseignée. */
  verifiedVersion: string;
  /**
   * Un examen existe pour cette fiche (contenu assez long). Décidé par le
   * serveur, identique pour tous : la règle n'est pas recopiée ici.
   */
  quizEligible: boolean;
};

/**
 * Réponse de la lecture **publique** d'une fiche (`GET /entries/:slug`), la
 * même pour tout le monde :
 * - `access: 'free'` : la fiche entière (elle ouvre un parcours publié) ;
 * - `access: 'reserved'` : l'en-tête **seul**. Le contenu n'est pas dans la
 *   réponse : il ne quitte le serveur que par `getReaderEntry`.
 *
 * Union discriminée : le compilateur oblige à tester `access` avant de lire
 * `bodyMdx`. Une page ne peut donc pas afficher par mégarde le contenu d'une
 * fiche réservée, il n'existe pas dans ce type.
 */
export type EntryDetail = (FullEntry & { access: 'free' }) | (EntryHeader & { access: 'reserved' });

/**
 * Issue de la lecture complète : la fiche, ou le refus du serveur.
 * `'unauthorized'` : pas de session (401). `'forbidden'` : adresse du compte
 * non vérifiée (403). `null` : fiche introuvable ou dépubliée (404).
 */
export type ReaderEntryResult = FullEntry | 'unauthorized' | 'forbidden' | null;

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
  return read<StackListItem[]>('/stacks', 'Impossible de charger les leçons');
}

export function getStackBySlug(slug: string): Promise<StackDetail | null> {
  return readOrNull<StackDetail>(`/stacks/${slug}`, 'Impossible de charger la leçon');
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

/**
 * Le slug d'une fiche est unique dans tout le catalogue : il suffit seul.
 *
 * `encodeURIComponent` : le slug peut venir d'une adresse (`/contact?fiche=`).
 * Sans encodage, `../stacks` ferait lire une autre route de l'API que celle
 * d'une fiche.
 */
export function getEntryBySlug(slug: string): Promise<EntryDetail | null> {
  return readOrNull<EntryDetail>(
    `/entries/${encodeURIComponent(slug)}`,
    'Impossible de charger la fiche',
  );
}

/**
 * Lecture **complète** d'une fiche, sous session
 * (`GET /reader/entries/:slug`).
 *
 * C'est la seule porte du contenu d'une fiche réservée. Le serveur la garde
 * par deux contrôles, dans l'ordre : une session (401 sinon), puis une adresse
 * vérifiée (403 sinon). 401 et 403 sont des réponses normales, pas des pannes :
 * elles reviennent comme des valeurs, et la page affiche l'invitation ou la
 * demande de vérification. Aucun identifiant de compte ne part dans la
 * requête : le serveur lit la session.
 */
export async function getReaderEntry(slug: string): Promise<ReaderEntryResult> {
  const response = await apiFetch(`/reader/entries/${encodeURIComponent(slug)}`);

  if (response.status === 401) return 'unauthorized';
  if (response.status === 403) return 'forbidden';
  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error('Impossible de charger la fiche');
  }

  return response.json() as Promise<FullEntry>;
}

/** Query de `GET /entries` (liste publique paginée + filtres US2/US3). */
export type SearchEntriesParams = {
  q?: string;
  /** Slug/valeur brute : le serveur valide (`@IsEnum` → 400 si hors liste). */
  kind?: string;
  difficulty?: string;
  stack?: string;
  tag?: string;
  page?: number;
  limit?: number;
};

/** Même enveloppe que les listes admin : `{ items, total, page, limit }`. */
export type SearchEntriesPage = {
  items: StackEntry[];
  total: number;
  page: number;
  limit: number;
};

/**
 * Recherche / liste publique des fiches publiées.
 *
 * Chaque paramètre n'est ajouté à la query que s'il est non vide : un filtre
 * « Tous » (valeur '') n'apparaît pas dans l'URL et ne contraint donc rien.
 *
 * 400 = query refusée par le DTO (`kind` hors enum, champ inconnu, `q` trop
 * long). On le traduit en phrase française plutôt que de dump le JSON Nest.
 */
export async function searchEntries(params: SearchEntriesParams = {}): Promise<SearchEntriesPage> {
  const query = new URLSearchParams();

  if (params.q) query.set('q', params.q);
  if (params.kind) query.set('kind', params.kind);
  if (params.difficulty) query.set('difficulty', params.difficulty);
  if (params.stack) query.set('stack', params.stack);
  if (params.tag) query.set('tag', params.tag);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const response = await apiFetch(`/entries${suffix}`);

  if (response.status === 400) {
    throw new Error('Cette recherche n’est pas valide.');
  }

  if (!response.ok) {
    throw new Error('Impossible de charger les fiches');
  }

  return response.json() as Promise<SearchEntriesPage>;
}
