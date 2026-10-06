import { Resend } from 'resend';
import {
  buildPasswordResetEmail,
  isResetMailConfigured,
  sendPasswordResetEmail,
} from './password-reset-mailer';

jest.mock('resend');

const URL = 'https://api.example.com/api/auth/reset-password/tok123?callbackURL=x';

describe('buildPasswordResetEmail', () => {
  it('contient le lien et un objet fixe', () => {
    const { subject, text } = buildPasswordResetEmail(URL);

    expect(subject).toBe('Réinitialisation du mot de passe');
    expect(text).toContain(URL);
  });
});

describe('isResetMailConfigured', () => {
  it('exige la clé et l’expéditeur', () => {
    expect(isResetMailConfigured({ RESEND_API_KEY: 'k', CONTACT_FROM_EMAIL: 'a@b.c' })).toBe(true);
    expect(isResetMailConfigured({ CONTACT_FROM_EMAIL: 'a@b.c' })).toBe(false);
    expect(isResetMailConfigured({ RESEND_API_KEY: 'k' })).toBe(false);
    expect(isResetMailConfigured({ RESEND_API_KEY: '  ', CONTACT_FROM_EMAIL: 'a@b.c' })).toBe(
      false,
    );
  });
});

describe('sendPasswordResetEmail', () => {
  const emailsSend = jest.fn();
  const saved = { ...process.env };

  beforeEach(() => {
    emailsSend.mockReset();
    jest.mocked(Resend).mockReset();
    jest
      .mocked(Resend)
      .mockImplementation(() => ({ emails: { send: emailsSend } }) as unknown as Resend);
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.CONTACT_FROM_EMAIL = 'Bibliothèque <no-reply@example.com>';
  });

  afterAll(() => {
    process.env = saved;
  });

  it('envoie le lien à l’adresse du compte', async () => {
    emailsSend.mockResolvedValue({ data: { id: '1' }, error: null });

    await expect(sendPasswordResetEmail('ada@example.com', URL)).resolves.toBe(true);

    expect(emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Bibliothèque <no-reply@example.com>',
        to: 'ada@example.com',
        text: expect.stringContaining(URL) as string,
      }),
    );
  });

  it('renvoie false sans appeler Resend si la configuration manque', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendPasswordResetEmail('ada@example.com', URL)).resolves.toBe(false);

    expect(emailsSend).not.toHaveBeenCalled();
  });

  it('renvoie false quand Resend refuse', async () => {
    emailsSend.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', statusCode: 422 },
    });

    await expect(sendPasswordResetEmail('ada@example.com', URL)).resolves.toBe(false);
  });

  it('renvoie false quand l’appel échoue', async () => {
    emailsSend.mockRejectedValue(new Error('réseau'));

    await expect(sendPasswordResetEmail('ada@example.com', URL)).resolves.toBe(false);
  });
});
