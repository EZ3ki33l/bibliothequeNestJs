import { apiFetch } from './api';

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
 * Les erreurs *attendues* (saisie invalide, conflit de slug, ressource
 * supprimée entre-temps) sont des valeurs de retour : le formulaire les affiche
 * à côté du champ. Les erreurs *inattendues* (réseau coupé, 500) sont levées,
 * car le formulaire n'a rien à en dire d'utile. Mélanger les deux obligerait
 * chaque appelant à deviner lequel est lequel.
 */
export type AdminWriteResult =
  { ok: true } | { ok: false; status: 400 | 404 | 409; message: string };

/** Libellés d'une ressource, pour composer des messages d'erreur en français. */
type ResourceLabels = {
  /** Segment d'URL sous `/admin`. */
  path: string;
  /** « le stack », « la catégorie »… */
  singular: string;
  /** « les stacks », « les catégories »… */
  plural: string;
  /** Message de 404 sur une écriture. */
  gone: string;
};

const STACKS: ResourceLabels = {
  path: 'stacks',
  singular: 'le stack',
  plural: 'les stacks',
  gone: 'Ce stack n’existe plus.',
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

/** Liste paginée. `page`/`limit` omis = valeurs par défaut du serveur. */
async function readPage<T>(
  resource: ResourceLabels,
  page?: number,
  limit?: number,
): Promise<AdminListPage<T>> {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  if (limit !== undefined) params.set('limit', String(limit));

  const query = params.toString();
  const response = await apiFetch(`/admin/${resource.path}${query.length > 0 ? `?${query}` : ''}`);

  if (!response.ok) {
    throw new Error(`Impossible de charger ${resource.plural}`);
  }

  return response.json() as Promise<AdminListPage<T>>;
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
};

/** Même contrat sans `categoryId` : une fiche ne change pas de catégorie. */
export type UpdateAdminEntryInput = Omit<CreateAdminEntryInput, 'categoryId'>;

export type AdminEntriesListPage = AdminListPage<AdminEntryListItem>;

export function listAdminEntries(page?: number, limit?: number): Promise<AdminEntriesListPage> {
  return readPage<AdminEntryListItem>(ENTRIES, page, limit);
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

export function deleteAdminEntry(id: string): Promise<void> {
  return remove(ENTRIES, id);
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

/**
 * Compteurs du dashboard.
 *
 * On ne demande qu'une page de chaque ressource et on ne garde que `total` :
 * les trois requêtes partent en parallèle (`Promise.all`), donc l'attente est
 * celle de la plus lente, pas leur somme.
 */
export async function getAdminDashboardCounts() {
  const [stacks, categories, entries] = await Promise.all([
    listAdminStacks(),
    listAdminCategories(),
    listAdminEntries(),
  ]);

  return { stacks: stacks.total, categories: categories.total, entries: entries.total };
}
