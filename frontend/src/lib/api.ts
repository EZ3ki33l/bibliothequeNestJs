export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}
