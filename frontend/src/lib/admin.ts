import { apiFetch } from './api';
import type { EntrySource, EntrySourceInput } from './entrySources';

/**
 * Couche d'accès à l'API d'administration.
 *
 * Un seul rôle : parler HTTP et traduire les réponses en valeurs que les
 * composants peuvent afficher. Aucun composant ne fait de `fetch` lui-même, et
 * jamais de Prisma côté navigateur — le client ne voit que l'API Nest.
 *
 * Les trois ressources (stacks, catégories, fiches) exposent le même CRUD, donc
 * la mécanique est écrite **une fois** dans les fonctions génériques du haut de
 * fichier ; chaque ressource ne déclare ensuite que ses types et ses libellés.
 * Les parcours ont en plus des sous-ressources (modules, étapes) dont les
 * écritures renvoient le parcours entier (`AdminPathWriteResult`).
 */

// ---------------------------------------------------------------------------
// Formes communes
// ---------------------------------------------------------------------------

/** Réponse d'un guard : `GET /admin/me`. */
export type AdminMeResult = 'ok' | 'unauthorized' | 'forbidden';

/** Enveloppe de pagination renvoyée par toutes les listes admin. */
export type AdminListPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

/**
 * Résultat d'une écriture.
 *
 * Les erreurs *attendues* (saisie invalide, droits insuffisants, conflit de
 * slug, ressource supprimée entre-temps) sont des valeurs de retour : le formulaire les affiche
 * à côté du champ. Les erreurs *inattendues* (réseau coupé, 500) sont levées,
 * car le formulaire n'a rien à en dire d'utile. Mélanger les deux obligerait
 * chaque appelant à deviner lequel est lequel.
 */
export type AdminWriteResult =
  { ok: true } | { ok: false; status: 400 | 403 | 404 | 409; message: string };

/**
 * Suppression refusée par le serveur faute de droits (403).
 *
 * Un rôle `ADMIN` ne supprime que des brouillons : le serveur explique le refus
 * et ce message mérite d'être affiché tel quel, contrairement à une panne
 * réseau. Une classe dédiée permet à l'appelant de faire la différence.
 */
export class AdminRefusedError extends Error {}

/** Libellés d'une ressource, pour composer des messages d'erreur en français. */
type ResourceLabels = {
  /** Segment d'URL sous `/admin`. */
  path: string;
  /** « la leçon », « la catégorie »… */
  singular: string;
  /** « les leçons », « les catégories »… */
  plural: string;
  /** Message de 404 sur une écriture. */
  gone: string;
};

const STACKS: ResourceLabels = {
  path: 'stacks',
  singular: 'la leçon',
  plural: 'les leçons',
  gone: 'Cette leçon n’existe plus.',
};

const CATEGORIES: ResourceLabels = {
  path: 'categories',
  singular: 'la catégorie',
  plural: 'les catégories',
  gone: 'Cette catégorie n’existe plus.',
};

const ENTRIES: ResourceLabels = {
  path: 'entries',
  singular: 'la fiche',
  plural: 'les fiches',
  gone: 'Cette fiche n’existe plus.',
};

// ---------------------------------------------------------------------------
// Mécanique HTTP partagée
// ---------------------------------------------------------------------------

/**
 * Extrait le message d'erreur d'une réponse Nest.
 *
 * `ValidationPipe` renvoie `message` sous forme de tableau (une entrée par
 * champ invalide), les exceptions métier sous forme de chaîne : les deux cas
 * sont traités. En dernier recours, un message générique — on n'affiche jamais
 * un corps de réponse brut à l'utilisateur.
 */
async function messageFromNest(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();

    if (typeof body === 'object' && body !== null && 'message' in body) {
      const raw = (body as { message: unknown }).message;

      if (typeof raw === 'string' && raw.length > 0) {
        return raw;
      }
      if (Array.isArray(raw) && raw.every((item) => typeof item === 'string')) {
        return raw.join(' ');
      }
    }
  } catch {
    // Corps non JSON (502 d'un proxy, page HTML…) : on garde le message générique.
  }

  return 'La saisie est invalide';
}

/**
 * Retire les champs « vides » d'un payload de **création**.
 *
 * Le serveur applique ses propres valeurs par défaut (`summary: ''`,
 * `published: false`, `difficulty: 'BEGINNER'`…) : lui envoyer des champs vides
 * ne sert à rien et masque son intention.
 *
 * À n'utiliser que pour un `POST`. Sur un `PATCH`, une chaîne vide veut dire
 * « efface cette valeur » : la retirer empêcherait de vider une description.
 */
function withoutEmptyFields<T extends object>(payload: T): T {
  const entries = Object.entries(payload).filter(([, value]) => {
    if (value === undefined) return false;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
    return true;
  });

  return Object.fromEntries(entries) as T;
}

/**
 * Liste paginée. `page`/`limit` omis = valeurs par défaut du serveur.
 * `filters` ajoute des paramètres propres à la ressource (`q` pour les fiches) ;
 * une valeur vide n'est pas envoyée.
 */
async function readPage<T>(
  resource: ResourceLabels,
  page?: number,
  limit?: number,
  filters: Record<string, string | undefined> = {},
): Promise<AdminListPage<T>> {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  if (limit !== undefined) params.set('limit', String(limit));
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  const response = await apiFetch(`/admin/${resource.path}${query.length > 0 ? `?${query}` : ''}`);

  if (!response.ok) {
    throw new Error(`Impossible de charger ${resource.plural}`);
  }

  return response.json() as Promise<AdminListPage<T>>;
}

/** Plafond de `limit` imposé par le serveur (`PaginationQueryDto`). */
const MAX_PAGE_SIZE = 50;

/**
 * Tous les éléments d'une ressource, quel que soit leur nombre.
 *
 * Le serveur plafonne une page à 50 lignes (protection contre une requête qui
 * viderait la table). Une liste déroulante alimentée par une seule page perdrait
 * donc en silence le 51ᵉ élément : impossible alors de choisir la catégorie
 * d'une nouvelle fiche. La première page donne le total, les suivantes partent
 * en parallèle.
 *
 * Réservé aux listes de choix (stacks, catégories, parcours), dont la taille
 * reste modeste. Une liste affichée à l'écran reste paginée.
 */
async function readAll<T>(resource: ResourceLabels): Promise<T[]> {
  const first = await readPage<T>(resource, 1, MAX_PAGE_SIZE);
  const pageCount = Math.ceil(first.total / MAX_PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      readPage<T>(resource, index + 2, MAX_PAGE_SIZE),
    ),
  );

  return [first, ...rest].flatMap((page) => page.items);
}

/**
 * Lecture d'une ressource par id.
 *
 * `null` couvre 404 (supprimée) **et** 400 (id mal formé) : dans les deux cas
 * l'écran affiche « n'existe pas ». Distinguer les deux n'apporterait rien à
 * l'utilisateur, qui a suivi un lien devenu invalide.
 */
async function readById<T>(resource: ResourceLabels, id: string): Promise<T | null> {
  const response = await apiFetch(`/admin/${resource.path}/${id}`);

  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Impossible de charger ${resource.singular}`);
  }

  return response.json() as Promise<T>;
}

/** POST ou PATCH, avec la même traduction des statuts d'erreur. */
async function write(
  resource: ResourceLabels,
  method: 'POST' | 'PATCH',
  path: string,
  body: object,
  failure: string,
): Promise<AdminWriteResult> {
  const response = await apiFetch(path, { method, body: JSON.stringify(body) });

  if (response.ok) {
    return { ok: true };
  }

  switch (response.status) {
    // Saisie refusée par le DTO côté serveur.
    case 400:
      return { ok: false, status: 400, message: await messageFromNest(response) };
    // Rôle `ADMIN` : publication, ou écriture sur un contenu publié.
    case 403:
      return { ok: false, status: 403, message: await messageFromNest(response) };
    // Ressource (ou parent) disparue entre le chargement et l'envoi.
    case 404:
      return { ok: false, status: 404, message: resource.gone };
    // Contrainte d'unicité : slug déjà pris, nom trop proche…
    case 409:
      return { ok: false, status: 409, message: await messageFromNest(response) };
    default:
      throw new Error(failure);
  }
}

/** Création : le payload est nettoyé de ses champs vides. */
function create(resource: ResourceLabels, payload: object): Promise<AdminWriteResult> {
  return write(
    resource,
    'POST',
    `/admin/${resource.path}`,
    withoutEmptyFields(payload),
    `Impossible de créer ${resource.singular}`,
  );
}

/** Modification : le payload part tel quel, une valeur vide efface le champ. */
function update(resource: ResourceLabels, id: string, payload: object): Promise<AdminWriteResult> {
  return write(
    resource,
    'PATCH',
    `/admin/${resource.path}/${id}`,
    payload,
    `Impossible de modifier ${resource.singular}`,
  );
}

/**
 * Suppression. Pas de `AdminWriteResult` ici : il n'y a rien à corriger dans un
 * formulaire, la page affiche simplement une notification d'échec.
 */
async function remove(resource: ResourceLabels, id: string): Promise<void> {
  const response = await apiFetch(`/admin/${resource.path}/${id}`, { method: 'DELETE' });

  // 204 No Content : succès sans corps de réponse.
  if (response.status === 204) {
    return;
  }

  if (response.status === 403) {
    throw new AdminRefusedError(await messageFromNest(response));
  }

  throw new Error(
    response.status === 404 ? resource.gone : `Impossible de supprimer ${resource.singular}`,
  );
}

// ---------------------------------------------------------------------------
// Garde d'accès
// ---------------------------------------------------------------------------

/**
 * Vérifie les droits admin auprès du serveur.
 *
 * On interroge l'API plutôt que de lire la session côté client : un état du
 * navigateur se modifie, une réponse du serveur non. Les deux refus sont
 * distingués car ils mènent à des écrans différents — 401 redirige vers la
 * connexion, 403 affiche un refus.
 */
export async function getAdminMe(): Promise<AdminMeResult> {
  const response = await apiFetch('/admin/me');

  if (response.status === 401) return 'unauthorized';
  if (response.status === 403) return 'forbidden';

  if (!response.ok) {
    throw new Error('Impossible de vérifier les droits admin');
  }

  return 'ok';
}

// ---------------------------------------------------------------------------
// Stacks
// ---------------------------------------------------------------------------

export type AdminStackListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  _count: { categories: number };
};

export type AdminStackDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

/** Le slug n'est pas modifiable : le serveur le recalcule depuis le nom. */
export type AdminStackInput = {
  name: string;
  description?: string;
};

export type AdminStacksListPage = AdminListPage<AdminStackListItem>;

export function listAdminStacks(page?: number, limit?: number): Promise<AdminStacksListPage> {
  return readPage<AdminStackListItem>(STACKS, page, limit);
}

/** Tous les stacks, pour une liste de choix (voir `readAll`). */
export function listAllAdminStacks(): Promise<AdminStackListItem[]> {
  return readAll<AdminStackListItem>(STACKS);
}

export function getAdminStackById(id: string): Promise<AdminStackDetail | null> {
  return readById<AdminStackDetail>(STACKS, id);
}

export function createAdminStack(payload: AdminStackInput): Promise<AdminWriteResult> {
  return create(STACKS, payload);
}

export function updateAdminStack(id: string, payload: AdminStackInput): Promise<AdminWriteResult> {
  return update(STACKS, id, payload);
}

export function deleteAdminStack(id: string): Promise<void> {
  return remove(STACKS, id);
}

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

export type AdminCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  stack: {
    id: string;
    name: string;
    slug: string;
  };
  _count: { entries: number };
};

export type AdminCategoryDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  stack: {
    id: string;
    name: string;
    slug: string;
  };
};

/** `stackId` seulement à la création : changer de stack n'est pas un renommage. */
export type CreateAdminCategoryInput = {
  stackId: string;
  name: string;
  description?: string;
};

export type UpdateAdminCategoryInput = {
  name: string;
  description?: string;
};

export type AdminCategoriesListPage = AdminListPage<AdminCategoryListItem>;

export function listAdminCategories(
  page?: number,
  limit?: number,
): Promise<AdminCategoriesListPage> {
  return readPage<AdminCategoryListItem>(CATEGORIES, page, limit);
}

/** Toutes les catégories, pour une liste de choix (voir `readAll`). */
export function listAllAdminCategories(): Promise<AdminCategoryListItem[]> {
  return readAll<AdminCategoryListItem>(CATEGORIES);
}

export function getAdminCategoryById(id: string): Promise<AdminCategoryDetail | null> {
  return readById<AdminCategoryDetail>(CATEGORIES, id);
}

export function createAdminCategory(payload: CreateAdminCategoryInput): Promise<AdminWriteResult> {
  return create(CATEGORIES, payload);
}

export function updateAdminCategory(
  id: string,
  payload: UpdateAdminCategoryInput,
): Promise<AdminWriteResult> {
  return update(CATEGORIES, id, payload);
}

export function deleteAdminCategory(id: string): Promise<void> {
  return remove(CATEGORIES, id);
}

// ---------------------------------------------------------------------------
// Fiches
// ---------------------------------------------------------------------------

export type AdminEntryKind = 'FUNCTION' | 'COMPONENT' | 'CONCEPT';
export type AdminEntryDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type AdminEntryListItem = {
  id: string;
  title: string;
  slug: string;
  kind: AdminEntryKind;
  published: boolean;
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

export type AdminEntryDetail = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  bodyMdx: string;
  kind: AdminEntryKind;
  difficulty: AdminEntryDifficulty;
  tags: string[];
  published: boolean;
  template: string;
  /**
   * Colonnes JSON de Prisma : leur forme n'est pas garantie par le type.
   * `jsonToStringRecord` (dans `lib/stacks.ts`) les valide avant usage.
   */
  files: unknown;
  dependencies: unknown;
  sources: EntrySource[];
  /** `AAAA-MM-JJ`, ou `null` si la fiche n'a pas de date de vérification. */
  verifiedOn: string | null;
  verifiedVersion: string;
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

export type CreateAdminEntryInput = {
  categoryId: string;
  title: string;
  kind: AdminEntryKind;
  summary?: string;
  bodyMdx?: string;
  difficulty?: AdminEntryDifficulty;
  tags?: string[];
  published?: boolean;
  template?: string;
  files?: Record<string, string>;
  dependencies?: Record<string, string>;
  /** Présent : remplace la liste entière. Absent d'un `PATCH` : liste inchangée. */
  sources?: EntrySourceInput[];
  /** `null` efface la date. Absent d'un `PATCH` : date inchangée. */
  verifiedOn?: string | null;
  verifiedVersion?: string;
};

/** Même contrat sans `categoryId` : une fiche ne change pas de catégorie. */
export type UpdateAdminEntryInput = Omit<CreateAdminEntryInput, 'categoryId'>;

export type AdminEntriesListPage = AdminListPage<AdminEntryListItem>;

/**
 * Filtres de `GET /admin/entries`, combinés en ET par le serveur.
 *
 * `stackId`, `categoryId` et `pathId` sont des identifiants, pas des slugs :
 * l'administration manipule aussi des brouillons, dont le slug peut encore
 * changer avec le titre.
 */
export type AdminEntriesFilters = {
  /** Titre, casse ignorée. */
  q?: string;
  status?: 'draft' | 'published';
  stackId?: string;
  categoryId?: string;
  /** Fiches qui sont une étape de ce parcours. */
  pathId?: string;
};

/** Liste des fiches, brouillons compris. Un filtre vide n'est pas envoyé. */
export function listAdminEntries(
  page?: number,
  limit?: number,
  filters: AdminEntriesFilters = {},
): Promise<AdminEntriesListPage> {
  return readPage<AdminEntryListItem>(ENTRIES, page, limit, {
    ...filters,
    q: filters.q?.trim(),
  });
}

export function getAdminEntryById(id: string): Promise<AdminEntryDetail | null> {
  return readById<AdminEntryDetail>(ENTRIES, id);
}

export function createAdminEntry(payload: CreateAdminEntryInput): Promise<AdminWriteResult> {
  return create(ENTRIES, payload);
}

export function updateAdminEntry(
  id: string,
  payload: UpdateAdminEntryInput,
): Promise<AdminWriteResult> {
  return update(ENTRIES, id, payload);
}

/**
 * Publie ou dépublie une fiche sans passer par son formulaire.
 *
 * Le `PATCH` est partiel : seul `published` est envoyé, donc aucun autre champ
 * n'est réécrit (ni le titre, ni le slug qui en dépend). Le serveur applique les
 * mêmes droits que pour le formulaire : un rôle `ADMIN` reçoit un 403, renvoyé
 * ici comme une valeur avec le message à afficher.
 */
export function setAdminEntryPublished(id: string, published: boolean): Promise<AdminWriteResult> {
  return update(ENTRIES, id, { published });
}

export function deleteAdminEntry(id: string): Promise<void> {
  return remove(ENTRIES, id);
}

// ---------------------------------------------------------------------------
// Parcours
// ---------------------------------------------------------------------------

const PATHS: ResourceLabels = {
  path: 'learning-paths',
  singular: 'le parcours',
  plural: 'les parcours',
  gone: 'Ce parcours n’existe plus.',
};

export type AdminPathListItem = {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  position: number;
  moduleCount: number;
  stepCount: number;
};

export type AdminPathStep = {
  id: string;
  optional: boolean;
  entry: {
    id: string;
    title: string;
    slug: string;
    /** Une fiche brouillon reste dans le parcours mais n'apparaît pas côté public. */
    published: boolean;
    category: {
      id: string;
      name: string;
      slug: string;
      stack: { id: string; name: string; slug: string };
    };
  };
};

export type AdminPathModule = {
  id: string;
  title: string;
  description: string;
  steps: AdminPathStep[];
};

export type AdminPathDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  modules: AdminPathModule[];
};

export type AdminPathsListPage = AdminListPage<AdminPathListItem>;

/**
 * Résultat d'une écriture sur un parcours.
 *
 * Contrairement aux autres ressources, le serveur renvoie le **détail complet**
 * du parcours après chaque écriture (ajout d'étape, réordonnancement…) :
 * l'éditeur remplace son état d'un bloc, sans recharger. Les erreurs attendues
 * restent des valeurs, comme `AdminWriteResult`.
 */
export type AdminPathWriteResult =
  | { ok: true; path: AdminPathDetail }
  | { ok: false; status: 400 | 403 | 404 | 409; message: string };

async function writePath(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  body: object,
  failure: string,
): Promise<AdminPathWriteResult> {
  const response = await apiFetch(path, { method, body: JSON.stringify(body) });

  if (response.ok) {
    return { ok: true, path: (await response.json()) as AdminPathDetail };
  }

  switch (response.status) {
    case 400:
      return { ok: false, status: 400, message: await messageFromNest(response) };
    // Rôle `ADMIN` : publication, ou écriture sur un parcours publié.
    case 403:
      return { ok: false, status: 403, message: await messageFromNest(response) };
    // Parcours, module, étape ou fiche disparu entre le chargement et l'envoi.
    case 404:
      return {
        ok: false,
        status: 404,
        message: 'Cet élément n’existe plus : la page va se recharger.',
      };
    // Doublon, plafond atteint, ordre devenu obsolète : le serveur explique.
    case 409:
      return { ok: false, status: 409, message: await messageFromNest(response) };
    default:
      throw new Error(failure);
  }
}

/** Suppression d'une sous-ressource (module, étape) : 204 attendu. */
async function removePathPart(path: string, failure: string): Promise<void> {
  const response = await apiFetch(path, { method: 'DELETE' });

  if (response.status === 204) {
    return;
  }

  if (response.status === 403) {
    throw new AdminRefusedError(await messageFromNest(response));
  }

  throw new Error(response.status === 404 ? 'Cet élément n’existe plus.' : failure);
}

const pathUrl = (id: string) => `/admin/learning-paths/${id}`;

export function listAdminPaths(page?: number, limit?: number): Promise<AdminPathsListPage> {
  return readPage<AdminPathListItem>(PATHS, page, limit);
}

/** Tous les parcours, pour une liste de choix (voir `readAll`). */
export function listAllAdminPaths(): Promise<AdminPathListItem[]> {
  return readAll<AdminPathListItem>(PATHS);
}

export function getAdminPath(id: string): Promise<AdminPathDetail | null> {
  return readById<AdminPathDetail>(PATHS, id);
}

/** Le parcours naît brouillon ; le slug est calculé depuis le nom. */
export function createAdminPath(payload: {
  name: string;
  description?: string;
}): Promise<AdminPathWriteResult> {
  return writePath(
    'POST',
    '/admin/learning-paths',
    withoutEmptyFields(payload),
    'Impossible de créer le parcours',
  );
}

export function updateAdminPath(
  id: string,
  payload: { name?: string; description?: string; published?: boolean },
): Promise<AdminPathWriteResult> {
  return writePath('PATCH', pathUrl(id), payload, 'Impossible de modifier le parcours');
}

export function deleteAdminPath(id: string): Promise<void> {
  return remove(PATHS, id);
}

export function addAdminPathModule(
  pathId: string,
  payload: { title: string; description?: string },
): Promise<AdminPathWriteResult> {
  return writePath(
    'POST',
    `${pathUrl(pathId)}/modules`,
    withoutEmptyFields(payload),
    'Impossible d’ajouter le module',
  );
}

export function updateAdminPathModule(
  pathId: string,
  moduleId: string,
  payload: { title?: string; description?: string },
): Promise<AdminPathWriteResult> {
  return writePath(
    'PATCH',
    `${pathUrl(pathId)}/modules/${moduleId}`,
    payload,
    'Impossible de modifier le module',
  );
}

export function deleteAdminPathModule(pathId: string, moduleId: string): Promise<void> {
  return removePathPart(
    `${pathUrl(pathId)}/modules/${moduleId}`,
    'Impossible de supprimer le module',
  );
}

/** Ordre **complet** des modules : le serveur refuse (409) une liste devenue obsolète. */
export function reorderAdminPathModules(
  pathId: string,
  moduleIds: string[],
): Promise<AdminPathWriteResult> {
  return writePath(
    'PUT',
    `${pathUrl(pathId)}/modules/order`,
    { moduleIds },
    'Impossible de réordonner les modules',
  );
}

export function addAdminPathStep(
  pathId: string,
  moduleId: string,
  payload: { entryId: string; optional?: boolean },
): Promise<AdminPathWriteResult> {
  return writePath(
    'POST',
    `${pathUrl(pathId)}/modules/${moduleId}/steps`,
    payload,
    'Impossible d’ajouter l’étape',
  );
}

export function updateAdminPathStep(
  pathId: string,
  stepId: string,
  payload: { optional: boolean },
): Promise<AdminPathWriteResult> {
  return writePath(
    'PATCH',
    `${pathUrl(pathId)}/steps/${stepId}`,
    payload,
    'Impossible de modifier l’étape',
  );
}

export function deleteAdminPathStep(pathId: string, stepId: string): Promise<void> {
  return removePathPart(`${pathUrl(pathId)}/steps/${stepId}`, 'Impossible de retirer l’étape');
}

export function reorderAdminPathSteps(
  pathId: string,
  moduleId: string,
  stepIds: string[],
): Promise<AdminPathWriteResult> {
  return writePath(
    'PUT',
    `${pathUrl(pathId)}/modules/${moduleId}/steps/order`,
    { stepIds },
    'Impossible de réordonner les étapes',
  );
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

/**
 * Compteurs du dashboard.
 *
 * Seul `total` sert : chaque requête demande donc une seule ligne (`limit` 1)
 * plutôt qu'une page entière. Elles partent en parallèle (`Promise.all`), donc
 * l'attente est celle de la plus lente, pas leur somme.
 *
 * `drafts` réutilise le filtre d'état de la liste des fiches : le compteur et
 * la liste vers laquelle il mène ne peuvent pas diverger.
 */
export async function getAdminDashboardCounts() {
  const [stacks, categories, entries, drafts, paths] = await Promise.all([
    listAdminStacks(1, 1),
    listAdminCategories(1, 1),
    listAdminEntries(1, 1),
    listAdminEntries(1, 1, { status: 'draft' }),
    listAdminPaths(1, 1),
  ]);

  return {
    stacks: stacks.total,
    categories: categories.total,
    entries: entries.total,
    drafts: drafts.total,
    paths: paths.total,
  };
}
