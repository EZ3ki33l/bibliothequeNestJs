/**
 * Règles de la demande d'un message de vérification
 * (`POST /api/auth/send-verification-email`).
 *
 * Pures, comme celles de `account-deletion.ts` : elles décident, `auth.ts` les
 * branche sur le hook `before` de better-auth et traduit le refus en erreur
 * HTTP.
 */

/** Motif de refus, à traduire en réponse HTTP par l'appelant. `null` = autorisé. */
export type VerificationRequestRefusal = 'SESSION_REQUIRED' | 'MAILER_UNAVAILABLE';

/**
 * La demande n'est acceptée que **sous session**.
 *
 * Sans session, better-auth écrit à toute adresse inscrite et non vérifiée
 * qu'on lui donne : n'importe qui pourrait faire envoyer des messages à un
 * tiers, à répétition (inondation d'une boîte, épuisement du quota d'envoi).
 * Avec une session, better-auth exige que l'adresse soit celle du compte : la
 * demande ne peut donc viser que sa propre boîte.
 *
 * La session est contrôlée **d'abord** : un inconnu reçoit toujours 401, que
 * l'envoi soit configuré ou non. La réponse ne lui apprend rien sur la
 * configuration du serveur.
 */
export function verificationRequestRefusal(request: {
  hasSession: boolean;
  mailerConfigured: boolean;
}): VerificationRequestRefusal | null {
  if (!request.hasSession) {
    return 'SESSION_REQUIRED';
  }

  // Sans expéditeur, la demande échoue franchement au lieu de répondre
  // « message envoyé » à quelqu'un qui n'en recevra jamais.
  if (!request.mailerConfigured) {
    return 'MAILER_UNAVAILABLE';
  }

  return null;
}
