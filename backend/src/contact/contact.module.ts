import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { CONTACT_MAILER } from './contact-mailer';
import { ResendContactMailer } from './resend-contact-mailer';

/**
 * Frontière du domaine « contact ».
 *
 * Même montage que `QuizzesModule` : le jeton `CONTACT_MAILER` est associé à
 * l'implémentation Resend, et les tests remplacent cette seule ligne.
 */
@Module({
  controllers: [ContactController],
  providers: [ContactService, { provide: CONTACT_MAILER, useClass: ResendContactMailer }],
})
export class ContactModule {}
