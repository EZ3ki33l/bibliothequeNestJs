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

/** Aucune session dans l'application e2e, comme `getSession` de la doublure de `better-auth`. */
export function getSessionFromCtx(): Promise<null> {
  return Promise.resolve(null);
}
