import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

const unknownId = '00000000-0000-4000-8000-000000000001';

describe('Admin categories (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /admin/categories without cookie → 401', () => {
    return request(app.getHttpServer()).get('/admin/categories').expect(401);
  });

  it('GET /admin/categories/:id without cookie → 401', () => {
    return request(app.getHttpServer()).get(`/admin/categories/${unknownId}`).expect(401);
  });

  it('POST /admin/categories without cookie → 401', () => {
    return request(app.getHttpServer())
      .post('/admin/categories')
      .send({ stackId: unknownId, name: 'Test' })
      .expect(401);
  });

  it('PATCH /admin/categories/:id without cookie → 401', () => {
    return request(app.getHttpServer())
      .patch(`/admin/categories/${unknownId}`)
      .send({ name: 'Test' })
      .expect(401);
  });

  it('DELETE /admin/categories/:id without cookie → 401', () => {
    return request(app.getHttpServer()).delete(`/admin/categories/${unknownId}`).expect(401);
  });
});
