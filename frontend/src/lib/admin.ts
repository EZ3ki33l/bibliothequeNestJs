import { apiFetch } from './api';

export type AdminMeResult = 'ok' | 'unauthorized' | 'forbidden';

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

export async function getAdminMe(): Promise<AdminMeResult> {
  const response = await apiFetch('/admin/me');

  if (response.status === 401) {
    return 'unauthorized';
  }

  if (response.status === 403) {
    return 'forbidden';
  }

  if (!response.ok) {
    throw new Error('Impossible de vérifier les droits admin');
  }

  return 'ok';
}

export type AdminCategoriesListPage = {
  items: AdminCategoryListItem[];
  total: number;
  page: number;
  limit: number;
};

export async function listAdminCategories(
  page?: number,
  limit?: number,
): Promise<AdminCategoriesListPage> {
  const params = new URLSearchParams();
  if (page !== undefined) {
    params.set('page', String(page));
  }
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const query = params.toString();
  const path = query.length > 0 ? `/admin/categories?${query}` : `/admin/categories`;

  const response = await apiFetch(path);

  if (!response.ok) {
    throw new Error('Impossible de charger les catégories');
  }

  return response.json();
}

export type AdminEntryListItem = {
  id: string;
  title: string;
  slug: string;
  kind: 'FUNCTION' | 'COMPONENT' | 'CONCEPT';
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

export type AdminEntriesListPage = {
  items: AdminEntryListItem[];
  total: number;
  page: number;
  limit: number;
};

export async function listAdminEntries(
  page?: number,
  limit?: number,
): Promise<AdminEntriesListPage> {
  const params = new URLSearchParams();
  if (page !== undefined) {
    params.set('page', String(page));
  }
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const query = params.toString();
  const path = query.length > 0 ? `/admin/entries?${query}` : `/admin/entries`;

  const response = await apiFetch(path);

  if (!response.ok) {
    throw new Error('Impossible de charger les fiches');
  }
  return response.json();
}

export async function getAdminDashboardCounts() {
  const [stacks, categories, entries] = await Promise.all([
    listAdminStacks(),
    listAdminCategories(),
    listAdminEntries(),
  ]);
  return { stacks: stacks.total, categories: categories.total, entries: entries.total };
}

export type AdminStackListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  _count: { categories: number };
};

export type AdminStacksListPage = {
  items: AdminStackListItem[];
  total: number;
  page: number;
  limit: number;
};

export async function listAdminStacks(page?: number, limit?: number): Promise<AdminStacksListPage> {
  const params = new URLSearchParams();
  if (page !== undefined) {
    params.set('page', String(page));
  }
  if (limit !== undefined) {
    params.set('limit', String(limit));
  }

  const query = params.toString();
  const path = query.length > 0 ? `/admin/stacks?${query}` : `/admin/stacks`;

  const response = await apiFetch(path);

  if (!response.ok) {
    throw new Error('Impossible de charger les stacks');
  }

  return response.json();
}

export type CreateAdminStackInput = {
  name: string;
  description?: string;
};

export type CreateAdminStackResult =
  { ok: true } | { ok: false; status: 400 | 409; message: string };

async function messageFromNest(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const raw = (body as { message: unknown }).message;
      if (typeof raw === 'string' && raw.length > 0) {
        return raw;
      }
      if (Array.isArray(raw) && raw.every((item) => typeof item === 'string')) return raw.join(' ');
    }
  } catch {
    //corps non JSON
  }
  return 'La saisie est invalide';
}

export type CreateAdminCategoryInput = {
  stackId: string;
  name: string;
  description?: string;
};

export type CreateAdminCategoryResult =
  { ok: true } | { ok: false; status: 400 | 404 | 409; message: string };

export async function createAdminCategory(
  payload: CreateAdminCategoryInput,
): Promise<CreateAdminCategoryResult> {
  const body: CreateAdminCategoryInput = { stackId: payload.stackId, name: payload.name };
  if (payload.description !== undefined && payload.description.length > 0) {
    body.description = payload.description;
  }

  const response = await apiFetch('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (response.status === 201) {
    return { ok: true };
  }

  if (response.status === 400) {
    return { ok: false, status: 400, message: await messageFromNest(response) };
  }

  if (response.status === 404) {
    return { ok: false, status: 404, message: 'Ce stack n’existe plus.' };
  }

  if (response.status === 409) {
    return { ok: false, status: 409, message: await messageFromNest(response) };
  }

  throw new Error('Impossible de créer la catégorie');
}

export type CreateAdminEntryInput = {
  categoryId: string;
  title: string;
  kind: 'FUNCTION' | 'COMPONENT' | 'CONCEPT';
  summary?: string;
  bodyMdx?: string;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  tags?: string[];
  published?: boolean;
  template?: string;
  files?: Record<string, string>;
  dependencies?: Record<string, string>;
};

export type CreateAdminEntryResult =
  { ok: true } | { ok: false; status: 400 | 404 | 409; message: string };

export async function createAdminEntry(
  payload: CreateAdminEntryInput,
): Promise<CreateAdminEntryResult> {
  const body: CreateAdminEntryInput = {
    categoryId: payload.categoryId,
    title: payload.title,
    kind: payload.kind,
  };
  if (payload.summary !== undefined && payload.summary.length > 0) {
    body.summary = payload.summary;
  }
  if (payload.bodyMdx !== undefined && payload.bodyMdx.length > 0) {
    body.bodyMdx = payload.bodyMdx;
  }
  if (payload.difficulty !== undefined) {
    body.difficulty = payload.difficulty;
  }
  if (payload.tags !== undefined && payload.tags.length > 0) {
    body.tags = payload.tags;
  }
  if (payload.published === true) {
    body.published = true;
  }
  if (payload.template !== undefined && payload.template.length > 0) {
    body.template = payload.template;
  }
  if (payload.files !== undefined) {
    body.files = payload.files;
  }
  if (payload.dependencies !== undefined) {
    body.dependencies = payload.dependencies;
  }
  const response = await apiFetch('/admin/entries', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (response.status === 201) {
    return { ok: true };
  }
  if (response.status === 400) {
    return { ok: false, status: 400, message: await messageFromNest(response) };
  }
  if (response.status === 404) {
    return { ok: false, status: 404, message: 'Cette catégorie n’existe plus.' };
  }
  if (response.status === 409) {
    return { ok: false, status: 409, message: await messageFromNest(response) };
  }
  throw new Error('Impossible de créer la fiche');
}

export type AdminEntryDetail = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  bodyMdx: string;
  kind: 'FUNCTION' | 'COMPONENT' | 'CONCEPT';
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  tags: string[];
  published: boolean;
  template: string;
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

export async function getAdminEntryById(id: string): Promise<AdminEntryDetail | null> {
  const response = await apiFetch(`/admin/entries/${id}`);

  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Impossible de charger la fiche');
  }

  return response.json();
}

export type UpdateAdminEntryInput = Omit<CreateAdminEntryInput, 'categoryId'>;

export type UpdateAdminEntryResult =
  { ok: true } | { ok: false; status: 400 | 404 | 409; message: string };

export async function updateAdminEntry(
  id: string,
  payload: UpdateAdminEntryInput,
): Promise<UpdateAdminEntryResult> {
  const body: UpdateAdminEntryInput = { ...payload };

  const response = await apiFetch(`/admin/entries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return { ok: true };
  }

  if (response.status === 400) {
    return { ok: false, status: 400, message: await messageFromNest(response) };
  }

  if (response.status === 404) {
    return { ok: false, status: 404, message: 'Cette fiche n’existe plus.' };
  }

  if (response.status === 409) {
    return { ok: false, status: 409, message: await messageFromNest(response) };
  }

  throw new Error('Impossible de modifier la fiche');
}

export async function deleteAdminEntry(id: string): Promise<void> {
  const response = await apiFetch(`/admin/entries/${id}`, { method: 'DELETE' });

  if (response.status === 204) {
    return;
  }

  if (response.status === 404) {
    throw new Error(`Cette fiche n'existe plus`);
  }

  throw new Error('Impossible de supprimer la fiche');
}

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

export async function getAdminCategoryById(id: string): Promise<AdminCategoryDetail | null> {
  const response = await apiFetch(`/admin/categories/${id}`);

  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Impossible de charger la catégorie');
  }

  return response.json();
}

export type UpdateAdminCategoryInput = {
  name: string;
  description?: string;
};

export type UpdateAdminCategoryResult =
  { ok: true } | { ok: false; status: 400 | 404 | 409; message: string };

export async function updateAdminCategory(
  id: string,
  payload: UpdateAdminCategoryInput,
): Promise<UpdateAdminCategoryResult> {
  const body: UpdateAdminCategoryInput = { name: payload.name };
  if (payload.description !== undefined) {
    body.description = payload.description;
  }

  const response = await apiFetch(`/admin/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return { ok: true };
  }

  if (response.status === 400) {
    return { ok: false, status: 400, message: await messageFromNest(response) };
  }

  if (response.status === 404) {
    return { ok: false, status: 404, message: 'Cette catégorie n’existe plus.' };
  }

  if (response.status === 409) {
    return { ok: false, status: 409, message: await messageFromNest(response) };
  }

  throw new Error('Impossible de modifier la catégorie');
}

export async function deleteAdminCategory(id: string): Promise<void> {
  const response = await apiFetch(`/admin/categories/${id}`, { method: 'DELETE' });

  if (response.status === 204) {
    return;
  }

  if (response.status === 404) {
    throw new Error(`Cette catégorie n'existe plus`);
  }

  throw new Error('Impossible de supprimer la catégorie');
}

export async function createAdminStack(
  payload: CreateAdminStackInput,
): Promise<CreateAdminStackResult> {
  const body: CreateAdminStackInput = { name: payload.name };
  if (payload.description !== undefined && payload.description.length > 0) {
    body.description = payload.description;
  }

  const response = await apiFetch('/admin/stacks', { method: 'POST', body: JSON.stringify(body) });

  if (response.status === 201) {
    return { ok: true };
  }
  if (response.status === 400) {
    return { ok: false, status: 400, message: await messageFromNest(response) };
  }

  if (response.status === 409) {
    return { ok: false, status: 409, message: await messageFromNest(response) };
  }

  throw new Error('Impossible de créer le stack');
}

export type AdminStackDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

export async function getAdminStackById(id: string): Promise<AdminStackDetail | null> {
  const response = await apiFetch(`/admin/stacks/${id}`);

  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Impossible de charger le stack');
  }

  return response.json();
}

export type UpdateAdminStackInput = {
  name: string;
  description?: string;
};

export type UpdateAdminStackResult =
  { ok: true } | { ok: false; status: 400 | 404 | 409; message: string };

export async function updateAdminStack(
  id: string,
  payload: UpdateAdminStackInput,
): Promise<UpdateAdminStackResult> {
  const body: UpdateAdminStackInput = { name: payload.name };
  if (payload.description !== undefined) {
    body.description = payload.description;
  }

  const response = await apiFetch(`/admin/stacks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return { ok: true };
  }

  if (response.status === 400) {
    return { ok: false, status: 400, message: await messageFromNest(response) };
  }

  if (response.status === 404) {
    return { ok: false, status: 404, message: 'Ce stack n’existe plus.' };
  }

  if (response.status === 409) {
    return { ok: false, status: 409, message: await messageFromNest(response) };
  }

  throw new Error('Impossible de modifier le stack');
}

export async function deleteAdminStack(id: string): Promise<void> {
  const response = await apiFetch(`/admin/stacks/${id}`, { method: 'DELETE' });

  if (response.status === 204) {
    return;
  }

  if (response.status === 404) {
    throw new Error(`Ce stack n'existe plus`);
  }

  throw new Error('Impossible de supprimer le stack');
}
