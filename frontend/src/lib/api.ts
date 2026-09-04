/**
 * Adresse de l'API Nest.
 *
 * Vite n'expose au navigateur que les variables préfixées `VITE_` : c'est
 * volontaire, tout ce qui arrive ici est public. Aucun secret ne doit passer
 * par une variable `VITE_*`.
 */
export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/**
 * `fetch` vers l'API, avec les réglages nécessaires à chaque appel.
 *
 * `credentials: 'include'` est indispensable : le frontend (port 5173) et l'API
 * (port 4000) sont deux origines différentes, et sans cette option le
 * navigateur n'enverrait pas le cookie de session. Côté serveur, il y a la
 * contrepartie : CORS avec `credentials: true` et une origine explicite.
 *
 * Les en-têtes fournis par l'appelant sont fusionnés **après** les nôtres, donc
 * ils peuvent les remplacer si besoin.
 */
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
