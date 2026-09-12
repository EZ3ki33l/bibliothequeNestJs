import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

describe('Notes (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /notes without cookie → 401', () => {
    return request(app.getHttpServer()).get('/notes').expect(401);
  });

  it('PUT /notes/:entryId without cookie → 401', () => {
    return request(app.getHttpServer())
      .put('/notes/00000000-0000-4000-8000-000000000001')
      .send({ content: 'test' })
      .expect(401);
  });
  it('DELETE /notes/:entryId without cookie → 401', () => {
    return request(app.getHttpServer())
      .delete('/notes/00000000-0000-4000-8000-000000000001')
      .expect(401);
  });
});
