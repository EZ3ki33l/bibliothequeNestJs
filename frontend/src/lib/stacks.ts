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
