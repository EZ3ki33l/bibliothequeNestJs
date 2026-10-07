import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createAdminE2eApp } from './create-admin-e2e-app';

const pathId = '00000000-0000-4000-8000-000000000001';
const moduleId = '00000000-0000-4000-8000-000000000002';
const stepId = '00000000-0000-4000-8000-000000000003';

describe('Learning paths (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // L'app e2e n'installe pas le `ValidationPipe` global de `main.ts` : les
  // valeurs par défaut de pagination ne s'y appliquent pas. Ce test vérifie
  // seulement que la route est publique (pas de 401).
  it('GET /learning-paths without cookie → 200 (public)', async () => {
    const response = await request(app.getHttpServer()).get('/learning-paths').expect(200);
    expect(response.body).toMatchObject({ items: [], total: 0 });
  });

  // La progression est une donnée de compte : sans session, rien ne sort.
  it('GET /progress/learning-paths without cookie → 401', () => {
    return server().get('/progress/learning-paths').expect(401);
  });

  it('GET /progress/learning-paths/:slug without cookie → 401', () => {
    return server().get('/progress/learning-paths/maitriser-les-hooks-react').expect(401);
  });

  // Parcours commencés : même règle, et aucun paramètre ne désigne un compte.
  it('GET /progress/started-paths without cookie → 401', () => {
    return server().get('/progress/started-paths').expect(401);
  });

  describe('admin routes without cookie → 401', () => {
    const base = `/admin/learning-paths/${pathId}`;
    const cases: [string, () => request.Test][] = [
      ['GET /admin/learning-paths', () => server().get('/admin/learning-paths')],
      ['GET /admin/learning-paths/:id', () => server().get(base)],
      [
        'POST /admin/learning-paths',
        () => server().post('/admin/learning-paths').send({ name: 'Web' }),
      ],
      ['PATCH /admin/learning-paths/:id', () => server().patch(base).send({ published: true })],
      ['DELETE /admin/learning-paths/:id', () => server().delete(base)],
      ['POST …/modules', () => server().post(`${base}/modules`).send({ title: 'Bases' })],
      [
        'PUT …/modules/order',
        () =>
          server()
            .put(`${base}/modules/order`)
            .send({ moduleIds: [moduleId] }),
      ],
      [
        'PATCH …/modules/:moduleId',
        () => server().patch(`${base}/modules/${moduleId}`).send({ title: 'X' }),
      ],
      ['DELETE …/modules/:moduleId', () => server().delete(`${base}/modules/${moduleId}`)],
      [
        'POST …/modules/:moduleId/steps',
        () => server().post(`${base}/modules/${moduleId}/steps`).send({ entryId: pathId }),
      ],
      [
        'PUT …/modules/:moduleId/steps/order',
        () =>
          server()
            .put(`${base}/modules/${moduleId}/steps/order`)
            .send({ stepIds: [stepId] }),
      ],
      [
        'PATCH …/steps/:stepId',
        () => server().patch(`${base}/steps/${stepId}`).send({ optional: true }),
      ],
      ['DELETE …/steps/:stepId', () => server().delete(`${base}/steps/${stepId}`)],
    ];

    it.each(cases)('%s', (_label, send) => send().expect(401));
  });

  function server() {
    return request(app.getHttpServer());
  }
});
