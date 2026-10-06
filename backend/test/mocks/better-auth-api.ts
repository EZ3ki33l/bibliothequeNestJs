/** Doublure de `better-auth/api` : le vrai paquet est en ESM pur, illisible sous Jest. */
export class APIError extends Error {
  constructor(
    public readonly status: string,
    public readonly body?: { message?: string },
  ) {
    super(body?.message ?? status);
  }
}

export function createAuthMiddleware<T>(handler: T): T {
  return handler;
}
