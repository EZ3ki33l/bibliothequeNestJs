import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CONTACT_MAILER, type ContactMailer } from './contact-mailer';
import { ContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(@Inject(CONTACT_MAILER) private readonly mailer: ContactMailer) {}

  async send(dto: ContactDto): Promise<void> {
    // Piège renseigné : c'est un robot. Réponse identique à un succès (204),
    // sans envoi, pour ne rien lui apprendre sur ce qui l'a écarté.
    if (dto.alias) {
      return;
    }

    const sent = await this.mailer.send({
      name: dto.name,
      email: dto.email,
      message: dto.message,
    });

    // Fail-closed : jamais de « envoyé » sans certitude.
    if (!sent) {
      throw new ServiceUnavailableException('Envoi indisponible, réessayer plus tard');
    }
  }
}
