import { apiFetch } from './api';

export type StackListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  _count: { categories: number };
};

export type EntryKind = 'FUNCTION' | 'COMPONENT' | 'CONCEPT';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

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

export async function listStacks(): Promise<StackListItem[]> {
  const response = await apiFetch('/stacks');

  if (!response.ok) {
    throw new Error('Impossible de charger les stacks');
  }

  return response.json();
}

export async function getStackBySlug(slug: string): Promise<StackDetail | null> {
  const response = await apiFetch(`/stacks/${slug}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Impossible de charger le stack');
  }

  return response.json();
}

export async function getCategoryBySlugs(
  stackSlug: string,
  categorySlug: string,
): Promise<CategoryDetail | null> {
  const response = await apiFetch(`/stacks/${stackSlug}/categories/${categorySlug}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Impossible de charger la catégorie');
  }

  return response.json();
}

export async function getEntryBySlug(slug: string): Promise<EntryDetail | null> {
  const response = await apiFetch(`/entries/${slug}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Impossible de charger la fiche');
  }

  return response.json();
}
