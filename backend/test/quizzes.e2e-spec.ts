import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

describe('Quizzes (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /quizzes/start without cookie → 401', () => {
    return request(app.getHttpServer())
      .post('/quizzes/start')
      .send({ slug: 'use-state-compteur' })
      .expect(401);
  });

  const unknownId = '00000000-0000-4000-8000-000000000001';

  it('POST /quizzes/:id/submit without cookie → 401', () => {
    return request(app.getHttpServer())
      .post(`/quizzes/${unknownId}/submit`)
      .send({ answers: [{ questionId: 'q-usestate-1', choiceIndex: 0 }] })
      .expect(401);
  });
});
