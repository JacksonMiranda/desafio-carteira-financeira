import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { AppModule } from './../src/app.module';

type RegisterResponseBody = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  password?: unknown;
  unknownField?: unknown;
};

type LoginResponseBody = {
  access_token: string;
};

type ValidationErrorResponseBody = {
  message: string[];
};

type ProfileResponseBody = {
  userId: string;
  email: string;
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  it('registers, logs in and accesses a protected route', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'strong-password';

    const validationResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'E2E User',
        email,
        password,
        unknownField: true,
      })
      .expect(400);

    const validationBody =
      validationResponse.body as ValidationErrorResponseBody;

    expect(validationBody.message).toContain(
      'O campo "unknownField" não é permitido.',
    );

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'E2E User',
        email,
        password,
      })
      .expect(201);

    const registeredUser = registerResponse.body as RegisterResponseBody;

    expect(registeredUser).toMatchObject({
      name: 'E2E User',
      email,
    });
    expect(registeredUser).toHaveProperty('id');
    expect(registeredUser).not.toHaveProperty('password');
    expect(registeredUser).not.toHaveProperty('unknownField');

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'E2E User',
        email,
        password,
      })
      .expect(409);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const loginBody = loginResponse.body as LoginResponseBody;

    expect(loginBody).toHaveProperty('access_token');
    expect(typeof loginBody.access_token).toBe('string');

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
      .expect(200)
      .expect(({ body }) => {
        const profileBody = body as ProfileResponseBody;

        expect(profileBody).toEqual({
          userId: registeredUser.id,
          email,
        });
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
