import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { VERIFIED_EMAIL_REQUIRED } from '../common/free-access';
import { VerifiedEmailGuard } from './verified-email.guard';

/** Contexte d'exécution réduit à ce que le guard lit : la requête HTTP. */
function contextOf(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function sessionOf(user: Record<string, unknown>) {
  return { session: { user } };
}

describe('VerifiedEmailGuard', () => {
  const guard = new VerifiedEmailGuard();

  it('refuse (401) sans session : le guard a été placé seul', () => {
    expect(() => guard.canActivate(contextOf({}))).toThrow(UnauthorizedException);
  });

  it('refuse (401) une session sans utilisateur', () => {
    expect(() => guard.canActivate(contextOf({ session: {} }))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contextOf(sessionOf({ emailVerified: true })))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuse (403) un compte dont l’adresse n’est pas vérifiée, avec le message en français', () => {
    const run = () => guard.canActivate(contextOf(sessionOf({ id: 'u1', emailVerified: false })));

    expect(run).toThrow(ForbiddenException);
    expect(run).toThrow(VERIFIED_EMAIL_REQUIRED);
  });

  it('refuse (403) quand le champ est absent', () => {
    expect(() => guard.canActivate(contextOf(sessionOf({ id: 'u1' })))).toThrow(ForbiddenException);
  });

  it.each(['true', 1, null, {}, 'oui'])(
    'refuse (403) %p : seul le booléen true vaut « vérifié »',
    (emailVerified) => {
      expect(() => guard.canActivate(contextOf(sessionOf({ id: 'u1', emailVerified })))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('laisse passer un compte dont l’adresse est vérifiée', () => {
    expect(guard.canActivate(contextOf(sessionOf({ id: 'u1', emailVerified: true })))).toBe(true);
  });
});
