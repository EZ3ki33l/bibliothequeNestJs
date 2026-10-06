import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { ResendContactMailer } from './resend-contact-mailer';

jest.mock('resend');

describe('ResendContactMailer', () => {
  const emailsSend = jest.fn();
  const message = {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'Bonjour, une question sur une fiche.',
  };
  const fullConfig = {
    RESEND_API_KEY: 're_test_key',
    CONTACT_FROM_EMAIL: 'Bibliothèque <formulaire@example.com>',
    CONTACT_TO_EMAIL: 'contact@example.com',
  };

  const mailerWith = (config: Record<string, string>) =>
    new ResendContactMailer(new ConfigService(config));

  beforeEach(() => {
    emailsSend.mockReset();
    jest.mocked(Resend).mockReset();
    jest
      .mocked(Resend)
      .mockImplementation(() => ({ emails: { send: emailsSend } }) as unknown as Resend);
  });

  it.each(['RESEND_API_KEY', 'CONTACT_FROM_EMAIL', 'CONTACT_TO_EMAIL'])(
    'renvoie false sans appeler Resend si %s manque',
    async (missing) => {
      const config: Record<string, string> = { ...fullConfig };
      delete config[missing];

      await expect(mailerWith(config).send(message)).resolves.toBe(false);

      expect(emailsSend).not.toHaveBeenCalled();
    },
  );

  it('traite une variable blanche comme absente', async () => {
    await expect(mailerWith({ ...fullConfig, RESEND_API_KEY: '   ' }).send(message)).resolves.toBe(
      false,
    );

    expect(emailsSend).not.toHaveBeenCalled();
  });

  it('envoie un texte brut avec un objet fixe et le visiteur en replyTo', async () => {
    emailsSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await expect(mailerWith(fullConfig).send(message)).resolves.toBe(true);

    expect(Resend).toHaveBeenCalledWith('re_test_key');
    expect(emailsSend).toHaveBeenCalledWith({
      from: 'Bibliothèque <formulaire@example.com>',
      to: 'contact@example.com',
      replyTo: 'ada@example.com',
      subject: 'Nouveau message depuis le formulaire de contact',
      text: 'Nom : Ada\nCourriel : ada@example.com\n\nBonjour, une question sur une fiche.',
    });
  });

  it("n'injecte pas la saisie du visiteur dans l'objet du courriel", async () => {
    emailsSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await mailerWith(fullConfig).send({ ...message, name: 'Ada\r\nBcc: victime@example.com' });

    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Nouveau message depuis le formulaire de contact',
      }),
    );
  });

  it("renvoie false quand l'API répond par une erreur", async () => {
    emailsSend.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'secret ada@example.com', statusCode: 422 },
    });

    await expect(mailerWith(fullConfig).send(message)).resolves.toBe(false);
  });

  it("renvoie false quand l'appel lève une exception", async () => {
    emailsSend.mockRejectedValue(new Error('network down'));

    await expect(mailerWith(fullConfig).send(message)).resolves.toBe(false);
  });

  it("renvoie false quand l'exception n'est pas une Error", async () => {
    emailsSend.mockRejectedValue('boom');

    await expect(mailerWith(fullConfig).send(message)).resolves.toBe(false);
  });

  it('renvoie false quand Resend ne répond pas dans le délai', async () => {
    jest.useFakeTimers();

    try {
      emailsSend.mockReturnValue(new Promise(() => undefined));

      const result = mailerWith(fullConfig).send(message);
      await jest.advanceTimersByTimeAsync(10_000);

      await expect(result).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
