/**
 * Parcours commencés : lesquels, et dans quel ordre les proposer à l'accueil.
 *
 * Fonctions **pures** : elles ne lisent ni la base ni l'heure.
 * `PathProgressService` leur donne les dates d'activité du compte, elles
 * décident. Les règles se testent ainsi directement, comme `computePathProgress`.
 */

/**
 * Dernière activité d'un compte sur un ensemble de fiches, `null` s'il n'en a
 * aucune.
 *
 * `activityByEntry` : pour chaque fiche, la date la plus récente entre sa
 * dernière lecture et son dernier examen terminé. Un parcours est « commencé »
 * dès que cette fonction renvoie une date pour ses fiches visibles.
 */
export function lastActivity(
  entryIds: readonly string[],
  activityByEntry: ReadonlyMap<string, Date>,
): Date | null {
  let latest: Date | null = null;

  for (const entryId of entryIds) {
    const activity = activityByEntry.get(entryId);

    if (activity && (latest === null || activity.getTime() > latest.getTime())) {
      latest = activity;
    }
  }

  return latest;
}

/**
 * Garde les parcours commencés, les trie par dernière activité (la plus
 * récente d'abord) et coupe à `limit`.
 *
 * Un parcours sans activité (`lastActivityAt: null`) est écarté. À égalité de
 * date, l'ordre reçu est conservé (le tri de JavaScript est stable) : c'est
 * l'ordre éditorial des parcours, donc un résultat prévisible.
 *
 * Le tableau reçu n'est pas modifié.
 */
export function rankStartedPaths<T extends { lastActivityAt: Date | null }>(
  paths: readonly T[],
  limit: number,
): (T & { lastActivityAt: Date })[] {
  const started = paths.filter(
    (path): path is T & { lastActivityAt: Date } => path.lastActivityAt !== null,
  );

  return started
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
    .slice(0, Math.max(0, limit));
}
