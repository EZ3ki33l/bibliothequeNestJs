import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { CONTACT_MAILER } from '../src/contact/contact-mailer';

/**
 * `POST /contact` : route publique, donc ces tests portent sur ce qui la
 * protège — validation (le `ValidationPipe` est posé dans `main.ts`, il est
 * reproduit ici), champ piège, échec d'envoi et plafond de débit.
 */
describe('Contact (e2e)', () => {
  let app: INestApplication<App>;
  const send = jest.fn<Promise<boolean>, [unknown]>();

  const valid = {
    name: 'Ada',
    email: 'ada@example.com',
    message: 'Bonjour, une question sur une fiche.',
  };

  beforeEach(async () => {
    send.mockReset();
    send.mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: () => Promise.resolve(),
        $disconnect: () => Promise.resolve(),
        admin: { findUnique: () => Promise.resolve(null) },
      })
      .overrideProvider(CONTACT_MAILER)
      .useValue({ send })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('message valide → 204 et relais au mailer, sans cookie de session', async () => {
    await request(app.getHttpServer()).post('/contact').send(valid).expect(204);

    expect(send).toHaveBeenCalledWith(valid);
  });

  it('retire les espaces autour des champs', async () => {
    await request(app.getHttpServer())
      .post('/contact')
      .send({ ...valid, name: '  Ada  ', email: ' ada@example.com ' })
      .expect(204);

    expect(send).toHaveBeenCalledWith(valid);
  });

  it('champ piège renseigné → 204 mais aucun envoi', async () => {
    await request(app.getHttpServer())
      .post('/contact')
      .send({ ...valid, alias: 'http://spam.example' })
      .expect(204);

    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['courriel invalide', { ...valid, email: 'pas-un-courriel' }],
    ['message trop court', { ...valid, message: 'court' }],
    ['message trop long', { ...valid, message: 'a'.repeat(2001) }],
    ['nom vide', { ...valid, name: '   ' }],
    ['nom trop long', { ...valid, name: 'a'.repeat(101) }],
    ['champ inconnu', { ...valid, to: 'victime@example.com' }],
    ['corps vide', {}],
  ])('%s → 400, aucun envoi', async (_label, body) => {
    await request(app.getHttpServer()).post('/contact').send(body).expect(400);

    expect(send).not.toHaveBeenCalled();
  });

  it("échec d'envoi → 503", async () => {
    send.mockResolvedValue(false);

    await request(app.getHttpServer()).post('/contact').send(valid).expect(503);
  });

  it('au-delà de 5 messages par heure et par IP → 429', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/contact').send(valid).expect(204);
    }

    await request(app.getHttpServer()).post('/contact').send(valid).expect(429);

    expect(send).toHaveBeenCalledTimes(5);
  });
});
