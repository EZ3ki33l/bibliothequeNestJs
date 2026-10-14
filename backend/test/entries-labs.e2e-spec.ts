import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  createAdminE2eApp,
  RESERVED_ENTRY,
  RESERVED_LAB_FILE_MARKER,
} from './create-admin-e2e-app';

/**
 * Laboratoires (spec 018). L'application e2e n'a ni session ni
 * `ValidationPipe` : elle prouve le changement de contrat public (lecture
 * réduite) et le 413 ; les règles de chemins le sont par `lab-files.spec.ts`
 * et `entry-lab.dto.spec.ts`.
 */
describe('Entry labs (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createAdminE2eApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reduced read of a reserved entry carries `lab: { tool }` and nothing else', async () => {
    const response = await request(app.getHttpServer())
      .get(`/entries/${RESERVED_ENTRY.slug}`)
      .expect(200);
    const body = response.body as { lab: unknown };

    expect(body.lab).toEqual({ tool: 'VAGRANT' });
    expect(JSON.stringify(response.body)).not.toContain(RESERVED_LAB_FILE_MARKER);
    expect(JSON.stringify(response.body)).not.toContain('vagrant up');
  });

  it('GET /entries?lab=true → 200 (public)', () => {
    return request(app.getHttpServer()).get('/entries?lab=true').expect(200);
  });
});
