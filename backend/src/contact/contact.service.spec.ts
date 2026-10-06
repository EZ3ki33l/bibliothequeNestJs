import { ServiceUnavailableException } from '@nestjs/common';
import { ContactMailer } from './contact-mailer';
import { ContactService } from './contact.service';
import { ContactDto } from './dto/contact.dto';

describe('ContactService', () => {
  const send = jest.fn<ReturnType<ContactMailer['send']>, Parameters<ContactMailer['send']>>();
  const service = new ContactService({ send });

  const dto: ContactDto = {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'Bonjour, une question sur une fiche.',
  };

  beforeEach(() => {
    send.mockReset();
  });

  it('relaie le message au mailer', async () => {
    send.mockResolvedValue(true);

    await expect(service.send(dto)).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledWith({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Bonjour, une question sur une fiche.',
    });
  });

  it('ne transmet pas le champ piège au mailer', async () => {
    send.mockResolvedValue(true);

    await service.send({ ...dto, alias: '' });

    expect(send).toHaveBeenCalledWith(expect.not.objectContaining({ alias: expect.anything() }));
  });

  it('piège renseigné : succès apparent, aucun envoi', async () => {
    await expect(service.send({ ...dto, alias: 'http://spam.example' })).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
  });

  it("échec d'envoi : 503, jamais de faux succès", async () => {
    send.mockResolvedValue(false);

    await expect(service.send(dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
