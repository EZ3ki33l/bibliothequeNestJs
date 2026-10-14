import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp, FREE_ENTRY, RESERVED_ENTRY } from './create-admin-e2e-app';

const ENTRY_ID = FREE_ENTRY.id;
const IMAGE_ID = '6f1c2a9e-3b0d-4c55-9a8e-1d2f3a4b5c6d';

/**
 * Illustrations (spec 016). L'application e2e n'a pas de session (`getSession`
 * renvoie `null`) ni de `ValidationPipe` : elle prouve les 401 des routes
 * d'administration, les refus des pipes de paramètres et le 404 du relais.
 * Droits (403), plafonds (409, 429) et stockage (503) sont prouvés par
 * `entry-images.service.spec.ts` ; les DTO par `upload-entry-image.dto.spec.ts`.
 */
describe('Entry images (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('administration routes without a session', () => {
    it('POST /admin/entries/:entryId/images → 401', () =>
      request(app.getHttpServer())
        .post(`/admin/entries/${ENTRY_ID}/images`)
        .field('alt', 'Texte')
        .attach('file', Buffer.from('x'), 'x.png')
        .expect(401));

    it('PATCH /admin/entries/:entryId/images/:imageId → 401', () =>
      request(app.getHttpServer())
        .patch(`/admin/entries/${ENTRY_ID}/images/${IMAGE_ID}`)
        .send({ alt: 'Texte' })
        .expect(401));

    it('DELETE /admin/entries/:entryId/images/:imageId → 401', () =>
      request(app.getHttpServer())
        .delete(`/admin/entries/${ENTRY_ID}/images/${IMAGE_ID}`)
        .expect(401));

    it('GET /admin/images/usage → 401', () =>
      request(app.getHttpServer()).get('/admin/images/usage').expect(401));
  });

  describe('public relay', () => {
    it('answers 404 for an unknown image, without a session', () =>
      request(app.getHttpServer()).get(`/media/${IMAGE_ID}/reading`).expect(404));

    it('answers 400 for an identifier that is not a UUID', () =>
      request(app.getHttpServer()).get('/media/pas-un-uuid/reading').expect(400));

    it('answers 400 for an unknown variant', () =>
      request(app.getHttpServer()).get(`/media/${IMAGE_ID}/original`).expect(400));
  });

  describe('entry reads', () => {
    it('gives the images of a free entry', async () => {
      const response = await request(app.getHttpServer())
        .get(`/entries/${FREE_ENTRY.slug}`)
        .expect(200);

      expect(response.body).toHaveProperty('images', []);
    });

    it('gives no images in the reduced read of a reserved entry', async () => {
      const response = await request(app.getHttpServer())
        .get(`/entries/${RESERVED_ENTRY.slug}`)
        .expect(200);

      expect(response.body.access).toBe('reserved');
      expect(response.body).not.toHaveProperty('images');
    });
  });
});
