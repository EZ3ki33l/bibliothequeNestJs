import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

describe('Favorites (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /favorites without cookie → 401', () => {
    return request(app.getHttpServer()).get('/favorites').expect(401);
  });

  it('POST /favorites without cookie → 401', () => {
    return request(app.getHttpServer())
      .post('/favorites')
      .send({ entryId: '00000000-0000-4000-8000-000000000001' })
      .expect(401);
  });

  it('DELETE /favorites/:entryId without cookie → 401', () => {
    return request(app.getHttpServer())
      .delete('/favorites/00000000-0000-4000-8000-000000000001')
      .expect(401);
  });
});
