import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { withTimeout } from '../common/with-timeout';

const TIMEOUT_MS = 10_000;
const logger = new Logger('VerificationMailer');

/**
 * Objet et corps fixes : rien de la saisie de la personne n'y entre, hormis le
 * lien fabriqué par better-auth. Texte brut, donc rien à échapper. Le message
 * ne contient que ce qui sert à vérifier l'adresse.
 */
export function buildVerificationEmail(url: string): { subject: string; text: string } {
  return {
    subject: 'Vérification de l’adresse',
    text: [
      'Un compte a été créé avec cette adresse.',
      '',
      'Le lien suivant vérifie l’adresse et ouvre tout le catalogue. Il est valable une heure :',
      url,
      '',
      'Sans demande, ce message peut être ignoré : l’adresse ne sera pas vérifiée.',
    ].join('\n'),
  };
}

/**
 * L'envoi est-il possible ? Mêmes deux variables que la réinitialisation du
 * mot de passe et le formulaire de contact : aucun réglage propre à ce message.
 */
export function isVerificationMailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.CONTACT_FROM_EMAIL?.trim());
}

/**
 * Envoie le lien de vérification via Resend (même clé et même expéditeur
 * vérifié que les deux autres messages du site).
 *
 * Ne lève jamais d'exception et renvoie `false` au moindre doute : c'est
 * `auth.ts` qui traduit ce `false` en 503, pour que l'écran dise que le message
 * n'est pas parti au lieu d'annoncer un envoi qui n'a pas eu lieu.
 *
 * Minimisation : le lien est un secret de courte durée (il vérifie l'adresse)
 * et l'adresse est une donnée personnelle, donc aucun des deux n'est
 * journalisé, seulement le type d'erreur.
 */
export async function sendVerificationEmail(to: string, url: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    logger.warn('Verification skipped : RESEND_API_KEY or CONTACT_FROM_EMAIL is not set');
    return false;
  }

  try {
    const { error } = await withTimeout(
      new Resend(apiKey).emails.send({ from, to, ...buildVerificationEmail(url) }),
      TIMEOUT_MS,
    );

    if (error) {
      logger.warn(`Verification Resend error : ${error.name} (${error.statusCode ?? 'n/a'})`);
      return false;
    }

    return true;
  } catch (err) {
    logger.warn(`Verification Resend failed : ${err instanceof Error ? err.name : 'unknown'}`);
    return false;
  }
}
