export type ContactMessage = {
  name: string;
  email: string;
  message: string;
};

/**
 * Jeton d'injection du service d'envoi.
 *
 * Même principe que `QUIZ_GENERATOR` : `ContactMailer` est une interface (elle
 * disparaît à la compilation), donc Nest a besoin d'un jeton pour savoir quoi
 * injecter. `ContactService` ignore que Resend est derrière, et les tests
 * fournissent un faux envoi sans réseau.
 */
export const CONTACT_MAILER = Symbol('CONTACT_MAILER');

export interface ContactMailer {
  /**
   * `true` seulement si le message est réellement parti. Tout échec (variable
   * manquante, refus de l'API, délai dépassé) renvoie `false` : le service le
   * traduit en 503 plutôt que de faire croire à l'expéditeur que le message
   * est arrivé.
   */
  send(message: ContactMessage): Promise<boolean>;
}
