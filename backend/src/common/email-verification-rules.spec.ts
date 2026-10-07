import { verificationRequestRefusal } from './email-verification-rules';

describe('verificationRequestRefusal', () => {
  it('exige une session', () => {
    expect(verificationRequestRefusal({ hasSession: false, mailerConfigured: true })).toBe(
      'SESSION_REQUIRED',
    );
  });

  it('exige une session avant de dire quoi que ce soit de l’expéditeur', () => {
    expect(verificationRequestRefusal({ hasSession: false, mailerConfigured: false })).toBe(
      'SESSION_REQUIRED',
    );
  });

  it('refuse une demande sous session quand l’envoi n’est pas configuré', () => {
    expect(verificationRequestRefusal({ hasSession: true, mailerConfigured: false })).toBe(
      'MAILER_UNAVAILABLE',
    );
  });

  it('autorise une demande sous session quand l’envoi est configuré', () => {
    expect(verificationRequestRefusal({ hasSession: true, mailerConfigured: true })).toBeNull();
  });
});
