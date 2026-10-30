import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Public } from '../src/common/decorators/auth.decorator.js';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import type { AppConfig } from '../src/config/configuration.js';

// Ensure required env is present so ConfigModule's fail-fast validation passes
// even when no .env file is available (e.g. CI). Never clobber a real value.
process.env.DATABASE_URL ??=
  'postgresql://user:password@localhost:5432/test_db?schema=public';
process.env.NODE_ENV ??= 'test';

/**
 * Test-only fixture. The foundation ships no business DTOs yet, so this minimal
 * validated endpoint proves that the *global* ValidationPipe (whitelist +
 * forbidNonWhitelisted + transform) will guard any future endpoint. It is
 * registered only in this test module and never shipped.
 */
class EchoDto {
  @IsString()
  message!: string;
}

@Controller('echo')
@Public()
class EchoTestController {
  @Post()
  echo(@Body() dto: EchoDto): EchoDto {
    return dto;
  }
}

describe('Foundation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [EchoTestController],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the SAME configuration production uses, so this suite tests the real
    // request pipeline (prefix, versioning, validation, error envelope).
    const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');
    configureApp(app, appConfig);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 with status ok (liveness, no database required)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok' });
    });
  });

  describe('API versioning', () => {
    it('serves under the /api/v1 prefix, not the bare root', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect(res.status).toBe(404);
    });
  });

  describe('global ValidationPipe', () => {
    it('accepts a well-formed body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/echo')
        .send({ message: 'hello' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ message: 'hello' });
    });

    it('rejects unknown fields with 400 and the structured error envelope', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/echo')
        .send({ message: 'hello', injected: 'nope' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: expect.any(String), message: expect.any(String) },
      });
      // Field-level messages are surfaced for the client under details.
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });

    it('rejects a wrongly-typed field with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/echo')
        .send({ message: 123 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
