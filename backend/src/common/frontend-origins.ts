const DEFAULT_ORIGIN = 'http://localhost:5173';

/**
 * Liste des origines web autorisées, lue depuis `FRONTEND_ORIGIN`.
 *
 * La variable accepte plusieurs origines séparées par des virgules : le SPA
 * (Vite, 5173) et l'app mobile en mode web (Expo, 8081) sont deux origines
 * distinctes, et chacune doit être nommée explicitement. Jamais `*` : avec
 * `credentials: true`, le navigateur envoie le cookie de session, donc
 * autoriser n'importe quelle origine laisserait un autre site agir au nom de
 * l'utilisateur.
 *
 * Les espaces et les entrées vides (virgule finale) sont ignorés ; une valeur
 * absente ou vide retombe sur l'origine de développement par défaut.
 */
export function frontendOrigins(raw = process.env.FRONTEND_ORIGIN): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');

  return origins.length > 0 ? origins : [DEFAULT_ORIGIN];
}
