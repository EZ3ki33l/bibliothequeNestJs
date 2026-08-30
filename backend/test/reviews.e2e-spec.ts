import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

describe('Reviews (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /reviews/due without cookie → 401', () => {
    return request(app.getHttpServer()).get('/reviews/due').expect(401);
  });

  const unknownId = '00000000-0000-4000-8000-000000000001';

  it('POST /reviews/ensure without cookie → 401', () => {
    return request(app.getHttpServer())
      .post('/reviews/ensure')
      .send({ entryId: unknownId })
      .expect(401);
  });

  it('POST /reviews/:id/rate without cookie → 401', () => {
    return request(app.getHttpServer())
      .post(`/reviews/${unknownId}/rate`)
      .send({ rating: 'GOOD' })
      .expect(401);
  });
});
