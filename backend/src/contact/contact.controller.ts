import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { ContactDto } from './dto/contact.dto';

/**
 * Formulaire de contact : route **publique** (pas de `SessionGuard`, un
 * visiteur sans compte doit pouvoir écrire), donc protégée par le seul plafond
 * de débit : 5 messages / heure / IP, bien en dessous des 100 req/min globales.
 */
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  send(@Body() dto: ContactDto): Promise<void> {
    return this.contactService.send(dto);
  }
}
