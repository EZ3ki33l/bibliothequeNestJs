import {
  isValidDisplayName,
  MAX_DISPLAY_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
  mustRevokeOtherSessions,
  profileUpdateRefusal,
} from './account-profile';

describe('isValidDisplayName', () => {
  it.each(['Al', 'Ada Lovelace', 'x'.repeat(MAX_DISPLAY_NAME_LENGTH), '  Al  ', '<b>Ada</b>'])(
    'accepts %p',
    (name) => {
      expect(isValidDisplayName(name)).toBe(true);
    },
  );

  it.each([
    ['one character', 'A'],
    ['81 characters', 'x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1)],
    ['only spaces', '     '],
    ['one letter padded with spaces', '  A  '],
    ['two letters followed by a flood of spaces', `Al${' '.repeat(10_000)}`],
    ['empty', ''],
  ])('rejects a name of %s', (_label, name) => {
    expect(isValidDisplayName(name)).toBe(false);
  });

  it.each([undefined, null, 42, true, {}, ['Ada'], { toString: () => 'Ada' }])(
    'rejects %p, which is not text',
    (name) => {
      expect(isValidDisplayName(name)).toBe(false);
    },
  );

  it('uses the bounds of the sign-up form', () => {
    expect(MIN_DISPLAY_NAME_LENGTH).toBe(2);
    expect(MAX_DISPLAY_NAME_LENGTH).toBe(80);
  });
});

describe('profileUpdateRefusal', () => {
  it('accepts a body with a valid name alone', () => {
    expect(profileUpdateRefusal({ name: 'Ada Lovelace' })).toBeNull();
  });

  it.each([
    [{ image: 'https://example.com/pixel.png' }],
    [{ name: 'Ada', image: 'https://example.com/pixel.png' }],
    [{ name: 'Ada', email: 'autre@example.com' }],
    [{ name: 'Ada', emailVerified: true }],
    [{ name: 'Ada', role: 'SUPER_ADMIN' }],
    [{ name: 'Ada', inconnu: 1 }],
  ])('refuses %p with UNKNOWN_FIELD', (body) => {
    expect(profileUpdateRefusal(body)).toBe('UNKNOWN_FIELD');
  });

  it.each([[{}], [{ name: 'A' }], [{ name: '' }], [{ name: 42 }], [{ name: null }]])(
    'refuses %p with INVALID_NAME',
    (body) => {
      expect(profileUpdateRefusal(body)).toBe('INVALID_NAME');
    },
  );

  it.each([undefined, null, 'name=Ada', 42, [{ name: 'Ada' }]])(
    'refuses %p, which is not an object',
    (body) => {
      expect(profileUpdateRefusal(body)).toBe('INVALID_NAME');
    },
  );
});

describe('mustRevokeOtherSessions', () => {
  it('is satisfied by revokeOtherSessions: true', () => {
    expect(
      mustRevokeOtherSessions({
        currentPassword: 'ancien',
        newPassword: 'nouveau-mot-de-passe',
        revokeOtherSessions: true,
      }),
    ).toBe(true);
  });

  it.each([
    [{ currentPassword: 'ancien', newPassword: 'nouveau' }],
    [{ revokeOtherSessions: false }],
    [{ revokeOtherSessions: 'true' }],
    [{ revokeOtherSessions: 1 }],
    [{ revokeOtherSessions: null }],
  ])('refuses %p', (body) => {
    expect(mustRevokeOtherSessions(body)).toBe(false);
  });

  it.each([undefined, null, 'revokeOtherSessions=true', [true]])(
    'refuses %p, which is not an object',
    (body) => {
      expect(mustRevokeOtherSessions(body)).toBe(false);
    },
  );
});
