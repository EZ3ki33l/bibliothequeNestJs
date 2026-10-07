/**
 * Règle d'accès aux fiches, en fonction pure : quelles fiches se lisent sans
 * compte ?
 *
 * Une fiche est **en accès libre** si elle est une étape du premier module
 * d'au moins un parcours publié. Toute autre fiche publiée est **réservée** :
 * son contenu demande un compte dont l'adresse est vérifiée.
 *
 * Rien n'est enregistré sur la fiche : l'accès se déduit à chaque lecture de la
 * composition des parcours. Recomposer ou dépublier un parcours s'applique donc
 * à la lecture suivante, sans seconde source de vérité à tenir synchronisée.
 */

/**
 * Parcours tel que la règle le reçoit : modules **dans l'ordre**, étapes
 * **déjà limitées aux fiches publiées**. C'est `EntryAccessService` qui pose
 * ces deux conditions dans sa requête ; la fonction ne lit pas la base.
 */
export type AccessPath = {
  modules: { steps: { entryId: string }[] }[];
};

/**
 * Message du 403 rendu à un compte dont l'adresse n'est pas vérifiée. Partagé
 * par `VerifiedEmailGuard` et `EntryAccessService` : la même phrase, quelle que
 * soit la route qui refuse.
 */
export const VERIFIED_EMAIL_REQUIRED = 'La lecture de cette fiche demande une adresse vérifiée';

/**
 * Fiches en accès libre : pour chaque parcours, celles du premier module qui
 * compte au moins une étape.
 *
 * « Premier module » n'est pas « module de position 0 » : un module dont toutes
 * les fiches sont en brouillon n'est pas affiché au public, il ne compte donc
 * pas. Ce que le visiteur voit en tête d'un parcours est ce qu'il peut lire.
 *
 * Un parcours sans module, ou dont tous les modules sont vides, n'ouvre rien.
 */
export function freeEntryIds(paths: AccessPath[]): Set<string> {
  const free = new Set<string>();

  for (const path of paths) {
    const firstVisible = path.modules.find((module) => module.steps.length > 0);

    for (const step of firstVisible?.steps ?? []) {
      free.add(step.entryId);
    }
  }

  return free;
}
