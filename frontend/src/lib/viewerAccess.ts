import { authClient } from './auth';

/**
 * Le lecteur que l'écran a devant lui : visiteur, compte dont l'adresse reste
 * à vérifier, ou compte vérifié.
 *
 * **Affichage seulement.** Cette valeur choisit des libellés : la mention d'une
 * carte, le message d'une fiche réservée, la présence du rappel. Elle vient de
 * `useSession()`, un état du navigateur, donc modifiable : aucun contenu n'en
 * dépend. Le contenu d'une fiche réservée vient du serveur, qui relit le compte
 * en base à chaque requête (`GET /reader/entries/:slug`). Forcer `'verified'`
 * ici ne ferait qu'effacer des mentions.
 */
export type ViewerAccess = 'visitor' | 'unverified' | 'verified';

/** Ce que la fonction lit de l'utilisateur de la session. */
type SessionUserLike = { emailVerified?: unknown } | null | undefined;

/**
 * `=== true` : un champ absent ou d'un autre type ne vaut pas « vérifié ».
 * L'écran annonce alors une vérification à faire, et le serveur tranche.
 */
export function viewerAccess(user: SessionUserLike): ViewerAccess {
  if (!user) return 'visitor';

  return user.emailVerified === true ? 'verified' : 'unverified';
}

/**
 * Mention à porter sur une carte ou une étape, ou `null` s'il n'y en a pas.
 *
 * Rien pour une fiche en accès libre, pour un compte vérifié, ni tant que le
 * lecteur est indéterminé (`undefined`) : mieux vaut une mention absente un
 * instant qu'une mention fausse.
 */
export function accessMention(viewer: ViewerAccess | undefined, free: boolean): string | null {
  if (free || viewer === undefined || viewer === 'verified') return null;

  return viewer === 'visitor' ? 'Compte requis' : 'Adresse à vérifier';
}

/** Lecteur courant ; `undefined` tant que la session est en cours de lecture. */
export function useViewerAccess(): ViewerAccess | undefined {
  const { data: session, isPending } = authClient.useSession();

  return isPending ? undefined : viewerAccess(session?.user);
}
