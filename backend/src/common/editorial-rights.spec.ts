import { ForbiddenException } from '@nestjs/common';
import {
  assertCanPublish,
  assertUnlocked,
  canManagePublished,
  PUBLISH_RESERVED,
  PUBLISHED_LOCKED,
} from './editorial-rights';

describe('editorial rights', () => {
  describe('canManagePublished', () => {
    it('is reserved to SUPER_ADMIN', () => {
      expect(canManagePublished('SUPER_ADMIN')).toBe(true);
      expect(canManagePublished('ADMIN')).toBe(false);
    });
  });

  describe('assertCanPublish', () => {
    it('refuses published: true to an ADMIN', () => {
      expect(() => assertCanPublish('ADMIN', true)).toThrow(ForbiddenException);
      expect(() => assertCanPublish('ADMIN', true)).toThrow(PUBLISH_RESERVED);
    });

    it('lets an ADMIN keep a draft (false or absent)', () => {
      expect(() => assertCanPublish('ADMIN', false)).not.toThrow();
      expect(() => assertCanPublish('ADMIN', undefined)).not.toThrow();
    });

    it('lets a SUPER_ADMIN publish', () => {
      expect(() => assertCanPublish('SUPER_ADMIN', true)).not.toThrow();
    });
  });

  describe('assertUnlocked', () => {
    it('refuses published content to an ADMIN', () => {
      expect(() => assertUnlocked('ADMIN', true)).toThrow(ForbiddenException);
      expect(() => assertUnlocked('ADMIN', true)).toThrow(PUBLISHED_LOCKED);
    });

    it('uses the provided message', () => {
      expect(() => assertUnlocked('ADMIN', true, 'Catégorie verrouillée')).toThrow(
        'Catégorie verrouillée',
      );
    });

    it('lets an ADMIN write a draft', () => {
      expect(() => assertUnlocked('ADMIN', false)).not.toThrow();
    });

    it('lets a SUPER_ADMIN write published content', () => {
      expect(() => assertUnlocked('SUPER_ADMIN', true)).not.toThrow();
    });
  });
});
