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

export async function listeAdminCategories(): Promise<AdminCategoryListItem[]> {
  const response = await apiFetch('/admin/categories');

  if (!response.ok) {
    throw new Error('Impossible de charger les catégories');
  }

  return response.json();
}

export async function getAdminDashboardCounts() {
  const [stacks, categories] = await Promise.all([listAdminStacks(), listeAdminCategories()]);
  return { stacks: stacks.total, categories: categories.length };
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
