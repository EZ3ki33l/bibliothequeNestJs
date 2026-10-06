import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { withTimeout } from '../common/with-timeout';
import { ContactMailer, ContactMessage } from './contact-mailer';

const TIMEOUT_MS = 10_000;

/**
 * Objet fixe : jamais construit à partir de la saisie du visiteur. Le nom et le
 * courriel saisis vont dans le corps du message et dans `replyTo`, pas dans un
 * en-tête libre.
 */
const SUBJECT = 'Nouveau message depuis le formulaire de contact';

/**
 * Relaie un message de contact vers la boîte de l'éditeur via Resend.
 *
 * Règle de conduite : **en cas de doute, renvoyer `false`** (fail-closed). Le
 * service appelant répond alors 503, ce qui vaut mieux qu'un « message envoyé »
 * mensonger.
 *
 * Minimisation des données : rien n'est stocké ici ni journalisé. Les logs ne
 * contiennent que le type d'erreur, jamais le nom, le courriel, le message ni
 * la clé d'API.
 */
@Injectable()
export class ResendContactMailer implements ContactMailer {
  private readonly logger = new Logger(ResendContactMailer.name);

  constructor(private readonly config: ConfigService) {}

  async send({ name, email, message }: ContactMessage): Promise<boolean> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from = this.config.get<string>('CONTACT_FROM_EMAIL')?.trim();
    const to = this.config.get<string>('CONTACT_TO_EMAIL')?.trim();

    // Configuration incomplète : rien n'est tenté. Seuls les *noms* des
    // variables sont journalisés, jamais leurs valeurs.
    if (!apiKey || !from || !to) {
      this.logger.warn(
        'Contact skipped : RESEND_API_KEY, CONTACT_FROM_EMAIL or CONTACT_TO_EMAIL is not set',
      );
      return false;
    }

    try {
      // Le SDK ne lève pas d'exception sur un refus de l'API : il renvoie
      // `{ data, error }`, d'où la lecture de `error` plutôt qu'un seul catch.
      const { error } = await withTimeout(
        new Resend(apiKey).emails.send({
          from,
          to,
          replyTo: email,
          subject: SUBJECT,
          // Texte brut uniquement : pas de HTML construit avec une saisie
          // externe, donc rien à échapper.
          text: `Nom : ${name}\nCourriel : ${email}\n\n${message}`,
        }),
        TIMEOUT_MS,
      );

      if (error) {
        this.logger.warn(`Contact Resend error : ${error.name} (${error.statusCode ?? 'n/a'})`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.warn(`Contact Resend failed : ${err instanceof Error ? err.name : 'unknown'}`);
      return false;
    }
  }
}
