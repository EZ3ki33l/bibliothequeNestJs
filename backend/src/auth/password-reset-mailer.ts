import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { withTimeout } from '../common/with-timeout';

const TIMEOUT_MS = 10_000;
const logger = new Logger('PasswordResetMailer');

/**
 * Objet et corps fixes : rien de la saisie de la personne n'y entre, hormis le
 * lien fabriqué par better-auth. Texte brut, donc rien à échapper.
 */
export function buildPasswordResetEmail(url: string): { subject: string; text: string } {
  return {
    subject: 'Réinitialisation du mot de passe',
    text: [
      'Une réinitialisation du mot de passe a été demandée pour le compte associé à cette adresse.',
      '',
      'Le lien suivant permet de choisir un nouveau mot de passe. Il est valable une heure et ne sert qu’une fois :',
      url,
      '',
      'En l’absence de demande, ce message peut être ignoré : le mot de passe actuel reste inchangé.',
    ].join('\n'),
  };
}

/**
 * L'envoi est-il possible ? Sert à refuser la demande **avant** de créer un
 * jeton : la réponse est la même pour tout le monde (elle ne dépend pas de
 * l'existence du compte), donc elle ne renseigne pas sur les comptes.
 */
export function isResetMailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.CONTACT_FROM_EMAIL?.trim());
}

/**
 * Envoie le lien de réinitialisation via Resend (même clé et même expéditeur
 * vérifié que le formulaire de contact).
 *
 * Ne lève jamais d'exception et renvoie `false` au moindre doute : l'appelant
 * ne doit pas laisser transparaître l'échec, sinon la réponse de
 * `request-password-reset` différerait selon que le compte existe ou non.
 *
 * Minimisation : le lien est un secret (il permet de prendre le compte) et
 * l'adresse est une donnée personnelle, donc aucun des deux n'est journalisé —
 * seulement le type d'erreur.
 */
export async function sendPasswordResetEmail(to: string, url: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    logger.warn('Reset skipped : RESEND_API_KEY or CONTACT_FROM_EMAIL is not set');
    return false;
  }

  try {
    const { error } = await withTimeout(
      new Resend(apiKey).emails.send({ from, to, ...buildPasswordResetEmail(url) }),
      TIMEOUT_MS,
    );

    if (error) {
      logger.warn(`Reset Resend error : ${error.name} (${error.statusCode ?? 'n/a'})`);
      return false;
    }

    return true;
  } catch (err) {
    logger.warn(`Reset Resend failed : ${err instanceof Error ? err.name : 'unknown'}`);
    return false;
  }
}
