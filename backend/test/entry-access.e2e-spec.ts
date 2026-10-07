import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  createAdminE2eApp,
  DRAFT_ENTRY,
  FREE_ENTRY,
  RESERVED_BODY_MARKER,
  RESERVED_ENTRY,
} from './create-admin-e2e-app';

/** Ce qu'une fiche réservée ne transmet jamais sans droit de lecture. */
const RESERVED_KEYS = [
  'bodyMdx',
  'template',
  'files',
  'dependencies',
  'sources',
  'verifiedOn',
  'verifiedVersion',
  'quizEligible',
];

/**
 * Accès réservé (spec 015). L'application e2e n'a pas de session (`getSession`
 * renvoie toujours `null`) ni de `ValidationPipe` : elle prouve les 401 et les
 * lectures publiques. Le 403 d'un compte non vérifié est prouvé par
 * `verified-email.guard.spec.ts` et par les tests des services ; les refus du
 * DTO (`ids`) par `entry-ids-query.dto.spec.ts`.
 */
describe('Entry access (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('lectures publiques de l’accès', () => {
    // `?ids=a&ids=b` : sans `ValidationPipe`, la chaîne « a,b » ne serait pas
    // découpée. Le paramètre répété arrive déjà sous forme de liste.
    it('GET /access/entries without cookie → 200, free or reserved, drafts omitted', async () => {
      const response = await server()
        .get('/access/entries')
        .query({ ids: [FREE_ENTRY.id, RESERVED_ENTRY.id, DRAFT_ENTRY.id] })
        .expect(200);

      expect(response.body).toEqual({
        items: [
          { entryId: FREE_ENTRY.id, free: true },
          { entryId: RESERVED_ENTRY.id, free: false },
        ],
      });
    });

    it('GET /access/entries?ids=<uuid> without cookie → 200 (public)', () => {
      return server().get(`/access/entries?ids=${FREE_ENTRY.id}`).expect(200);
    });

    it('GET /access/summary without cookie → 200 with the number of free entries', async () => {
      const response = await server().get('/access/summary').expect(200);

      expect(response.body).toEqual({ freeEntryCount: 1 });
    });
  });

  describe('GET /entries/:slug (publique)', () => {
    it('answers the header alone for a reserved entry : no content leaves the server', async () => {
      const response = await server().get(`/entries/${RESERVED_ENTRY.slug}`).expect(200);
      const body = response.body as Record<string, unknown>;

      expect(body).toMatchObject({
        id: RESERVED_ENTRY.id,
        slug: RESERVED_ENTRY.slug,
        title: RESERVED_ENTRY.title,
        summary: 'Résumé public.',
        access: 'reserved',
      });
      for (const key of RESERVED_KEYS) {
        expect(body).not.toHaveProperty(key);
      }
      expect(response.text).not.toContain(RESERVED_BODY_MARKER);
    });

    it('answers the whole entry for a free one', async () => {
      const response = await server().get(`/entries/${FREE_ENTRY.slug}`).expect(200);

      expect(response.body).toMatchObject({
        slug: FREE_ENTRY.slug,
        access: 'free',
        bodyMdx: 'Contenu en accès libre.',
      });
    });

    // Un brouillon reste introuvable, sans forme réduite : 404, pas 200.
    it('answers 404 for a draft, not a reserved header', () => {
      return server().get(`/entries/${DRAFT_ENTRY.slug}`).expect(404);
    });

    it('answers 404 for an unknown slug', () => {
      return server().get('/entries/inconnu').expect(404);
    });
  });

  describe('GET /reader/entries/:slug (compte vérifié)', () => {
    it.each([
      ['a reserved entry', RESERVED_ENTRY.slug],
      ['a free entry', FREE_ENTRY.slug],
      ['a draft', DRAFT_ENTRY.slug],
      ['an unknown slug', 'inconnu'],
    ])('without cookie → 401 for %s, with no content', async (_label, slug) => {
      const response = await server().get(`/reader/entries/${slug}`).expect(401);

      expect(response.text).not.toContain(RESERVED_BODY_MARKER);
      expect(response.body).not.toHaveProperty('bodyMdx');
    });
  });

  describe('routes durcies : toujours 401 sans session', () => {
    it('PUT /progress/entries/:entryId/read on a reserved entry → 401', () => {
      return server().put(`/progress/entries/${RESERVED_ENTRY.id}/read`).expect(401);
    });

    it('POST /quizzes/start on a reserved entry → 401', () => {
      return server().post('/quizzes/start').send({ slug: RESERVED_ENTRY.slug }).expect(401);
    });
  });

  function server() {
    return request(app.getHttpServer());
  }
});
