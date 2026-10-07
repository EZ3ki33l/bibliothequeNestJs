import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

const entryId = '00000000-0000-4000-8000-000000000001';

describe('Entry progress (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // Les repères sont une donnée de compte : sans session, rien ne sort et
  // rien ne s'écrit. Le guard répond avant le DTO et avant le service.
  it('GET /progress/entries?ids= without cookie → 401', () => {
    return server().get(`/progress/entries?ids=${entryId}`).expect(401);
  });

  it('GET /progress/entries without ids nor cookie → 401, not 400', () => {
    return server().get('/progress/entries').expect(401);
  });

  it('PUT /progress/entries/:entryId/read without cookie → 401', () => {
    return server().put(`/progress/entries/${entryId}/read`).expect(401);
  });

  // Les révisions ont été retirées (spec 014) : leurs routes n'existent plus.
  // 404 et non 401 : aucune route ne correspond, aucun guard n'est consulté.
  describe('removed review routes → 404', () => {
    const cases: [string, () => request.Test][] = [
      ['GET /reviews/due', () => server().get('/reviews/due')],
      ['POST /reviews/ensure', () => server().post('/reviews/ensure').send({ entryId })],
      [
        'POST /reviews/:id/rate',
        () => server().post(`/reviews/${entryId}/rate`).send({ rating: 'GOOD' }),
      ],
    ];

    it.each(cases)('%s', (_label, send) => send().expect(404));
  });

  function server() {
    return request(app.getHttpServer());
  }
});
