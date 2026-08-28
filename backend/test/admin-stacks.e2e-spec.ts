import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

const unknownId = '00000000-0000-4000-8000-000000000001';

describe('Admin stacks (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /admin/stacks without cookie → 401', () => {
    return request(app.getHttpServer()).get('/admin/stacks').expect(401);
  });

  it('GET /admin/stacks/:id without cookie → 401', () => {
    return request(app.getHttpServer()).get(`/admin/stacks/${unknownId}`).expect(401);
  });

  it('POST /admin/stacks without cookie → 401', () => {
    return request(app.getHttpServer()).post('/admin/stacks').send({ name: 'Test' }).expect(401);
  });

  it('PATCH /admin/stacks/:id without cookie → 401', () => {
    return request(app.getHttpServer())
      .patch(`/admin/stacks/${unknownId}`)
      .send({ name: 'Test' })
      .expect(401);
  });

  it('DELETE /admin/stacks/:id without cookie → 401', () => {
    return request(app.getHttpServer()).delete(`/admin/stacks/${unknownId}`).expect(401);
  });
});
