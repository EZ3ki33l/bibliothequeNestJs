import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

const unknownId = '00000000-0000-4000-8000-000000000001';

describe('Admin entries (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /admin/entries without cookie → 401', () => {
    return request(app.getHttpServer()).get('/admin/entries').expect(401);
  });

  it('GET /admin/entries/:id without cookie → 401', () => {
    return request(app.getHttpServer()).get(`/admin/entries/${unknownId}`).expect(401);
  });

  it('POST /admin/entries without cookie → 401', () => {
    return request(app.getHttpServer())
      .post('/admin/entries')
      .send({
        categoryId: unknownId,
        title: 'Test',
        kind: 'FUNCTION',
      })
      .expect(401);
  });

  it('PATCH /admin/entries/:id without cookie → 401', () => {
    return request(app.getHttpServer())
      .patch(`/admin/entries/${unknownId}`)
      .send({ title: 'Test' })
      .expect(401);
  });

  it('DELETE /admin/entries/:id without cookie → 401', () => {
    return request(app.getHttpServer()).delete(`/admin/entries/${unknownId}`).expect(401);
  });
});
