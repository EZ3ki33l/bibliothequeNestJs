import type { Request } from 'express';

/**
 * Utilisateur tel que `SessionGuard` le dépose sur la requête.
 *
 * On ne déclare que ce dont l'application a besoin : better-auth renvoie
 * davantage de champs, mais un type large obligerait à les maintenir ici.
 */
export type SessionUser = { id: string };

/**
 * Requête Express **après** passage de `SessionGuard`.
 *
 * `session` est optionnel côté types : TypeScript ne sait pas qu'un guard s'est
 * exécuté avant le handler. C'est justement ce que `@CurrentUserId()` verrouille
 * une fois pour toutes, au lieu de laisser chaque contrôleur re-tester.
 *
 * Le `Request` importé est bien celui d'Express, pas le `Request` global de la
 * Fetch API — deux types homonymes qui n'ont rien en commun.
 */
export type AuthedRequest = Request & { session?: { user: SessionUser } };
