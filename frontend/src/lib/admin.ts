import { apiFetch } from './api';
import { listStacks } from './stacks';

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
  const [stacks, categories] = await Promise.all([listStacks(), listeAdminCategories()]);
  return { stacks: stacks.length, categories: categories.length };
}
