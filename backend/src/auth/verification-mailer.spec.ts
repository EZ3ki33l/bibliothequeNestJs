import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  buildVerificationEmail,
  isVerificationMailConfigured,
  sendVerificationEmail,
} from './verification-mailer';

jest.mock('resend');

const ADDRESS = 'ada@example.com';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.jeton-secret.signature';
const URL = `https://api.example.com/api/auth/verify-email?token=${TOKEN}&callbackURL=x`;

describe('buildVerificationEmail', () => {
  it('a un objet fixe et contient le lien', () => {
    const { subject, text } = buildVerificationEmail(URL);

    expect(subject).toBe('Vérification de l’adresse');
    expect(text).toContain(URL);
  });

  it('annonce la durée du lien et dit que le message peut être ignoré', () => {
    const { text } = buildVerificationEmail(URL);

    expect(text).toContain('valable une heure');
    expect(text).toContain('peut être ignoré');
  });

  it('ne contient le lien qu’une fois, en texte brut', () => {
    const { text } = buildVerificationEmail(URL);

    expect(text.split(URL)).toHaveLength(2);
    expect(text).not.toMatch(/<[a-z]/i);
  });
});

describe('isVerificationMailConfigured', () => {
  it('exige la clé et l’expéditeur', () => {
    expect(isVerificationMailConfigured({ RESEND_API_KEY: 'k', CONTACT_FROM_EMAIL: 'a@b.c' })).toBe(
      true,
    );
    expect(isVerificationMailConfigured({ CONTACT_FROM_EMAIL: 'a@b.c' })).toBe(false);
    expect(isVerificationMailConfigured({ RESEND_API_KEY: 'k' })).toBe(false);
    expect(
      isVerificationMailConfigured({ RESEND_API_KEY: '  ', CONTACT_FROM_EMAIL: 'a@b.c' }),
    ).toBe(false);
  });
});

describe('sendVerificationEmail', () => {
  const emailsSend = jest.fn();
  const saved = { ...process.env };
  let warn: jest.SpyInstance;

  beforeEach(() => {
    emailsSend.mockReset();
    jest.mocked(Resend).mockReset();
    jest
      .mocked(Resend)
      .mockImplementation(() => ({ emails: { send: emailsSend } }) as unknown as Resend);
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.CONTACT_FROM_EMAIL = 'Bibliothèque <no-reply@example.com>';
    // Les avertissements sont interceptés : le test lit ce qui serait journalisé.
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = saved;
  });

  /** Tout ce qui a été journalisé pendant le test, en une chaîne. */
  function logged(): string {
    return JSON.stringify(warn.mock.calls);
  }

  it('envoie le lien à l’adresse du compte', async () => {
    emailsSend.mockResolvedValue({ data: { id: '1' }, error: null });

    await expect(sendVerificationEmail(ADDRESS, URL)).resolves.toBe(true);

    expect(emailsSend).toHaveBeenCalledWith({
      from: 'Bibliothèque <no-reply@example.com>',
      to: ADDRESS,
      subject: 'Vérification de l’adresse',
      text: expect.stringContaining(URL) as string,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('renvoie false sans appeler Resend si la configuration manque', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendVerificationEmail(ADDRESS, URL)).resolves.toBe(false);

    expect(emailsSend).not.toHaveBeenCalled();
  });

  it('renvoie false sans appeler Resend si l’expéditeur manque', async () => {
    process.env.CONTACT_FROM_EMAIL = '   ';

    await expect(sendVerificationEmail(ADDRESS, URL)).resolves.toBe(false);

    expect(emailsSend).not.toHaveBeenCalled();
  });

  it('renvoie false quand Resend refuse', async () => {
    emailsSend.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', statusCode: 422, message: `refus pour ${ADDRESS}` },
    });

    await expect(sendVerificationEmail(ADDRESS, URL)).resolves.toBe(false);
  });

  it('renvoie false quand l’appel échoue', async () => {
    emailsSend.mockRejectedValue(new Error(`réseau coupé vers ${URL}`));

    await expect(sendVerificationEmail(ADDRESS, URL)).resolves.toBe(false);
  });

  it('renvoie false quand Resend ne répond pas dans les dix secondes', async () => {
    jest.useFakeTimers();
    emailsSend.mockReturnValue(new Promise<never>(() => undefined));

    const pending = sendVerificationEmail(ADDRESS, URL);
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBe(false);
  });

  // Le lien vérifie l'adresse et l'adresse est une donnée personnelle : aucun
  // des deux ne doit se retrouver dans les journaux, quelle que soit l'issue,
  // y compris quand l'erreur du prestataire les répète dans son message.
  it('ne journalise ni l’adresse ni le lien, quelle que soit l’issue', async () => {
    emailsSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'validation_error', statusCode: 422, message: `refus pour ${ADDRESS}` },
    });
    await sendVerificationEmail(ADDRESS, URL);

    emailsSend.mockRejectedValueOnce(new Error(`réseau coupé vers ${URL}`));
    await sendVerificationEmail(ADDRESS, URL);

    emailsSend.mockRejectedValueOnce(`échec brut ${ADDRESS} ${URL}`);
    await sendVerificationEmail(ADDRESS, URL);

    delete process.env.RESEND_API_KEY;
    await sendVerificationEmail(ADDRESS, URL);

    expect(warn).toHaveBeenCalledTimes(4);
    expect(logged()).not.toContain(ADDRESS);
    expect(logged()).not.toContain(TOKEN);
    expect(logged()).not.toContain('verify-email');
  });
});
