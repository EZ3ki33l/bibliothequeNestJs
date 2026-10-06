import { deletionRefusal, isPasswordProvided } from './account-deletion';

describe('isPasswordProvided', () => {
  it('accepte une chaîne non vide', () => {
    expect(isPasswordProvided('secret')).toBe(true);
  });

  it.each([undefined, null, '', 123, {}, ['secret']])('refuse %p', (value) => {
    expect(isPasswordProvided(value)).toBe(false);
  });
});

describe('deletionRefusal', () => {
  it('refuse la suppression d’un administrateur', () => {
    expect(deletionRefusal(true)).toBe('ADMIN_ACCOUNT');
  });

  it('autorise la suppression d’un compte ordinaire', () => {
    expect(deletionRefusal(false)).toBeNull();
  });
});
