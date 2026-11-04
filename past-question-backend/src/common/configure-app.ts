import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

import type { AppConfig } from '../config/configuration.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

/**
 * Applies the shared HTTP-layer configuration to a Nest application:
 *   - Helmet security headers
 *   - Environment-driven CORS
 *   - Global route prefix + URI API versioning (/api/v1/...)
 *   - Global ValidationPipe (whitelist, forbid unknown fields, transform)
 *   - Global exception filter (consistent, leak-free error envelope)
 *
 * Extracted from `main.ts` so the production bootstrap and the e2e test suite
 * configure the application identically — tests exercise the real request
 * pipeline rather than a divergent copy. Server-lifecycle concerns (listen,
 * shutdown hooks) stay in `main.ts`.
 */
export function configureApp(app: INestApplication, config: AppConfig): void {
  // Capture the exact webhook bytes before JSON parsing for signature verification.
  app.use(json({ limit: '2mb', verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf.toString('utf8'); } }));
  app.use(urlencoded({ extended: false, limit: '2mb' }));

  // Trust reverse-proxy headers only when explicitly configured, so that
  // req.ip (used for rate limiting and audit) reflects the real client.
  app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxy);

  // Security headers.
  app.use(helmet());

  // CORS configured per environment (never hardcode production origins).
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });

  // Versioned REST API: e.g. GET /api/v1/health.
  app.setGlobalPrefix(config.apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.apiVersion,
  });

  // Reject unexpected fields before they reach application logic.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Consistent error envelope; hides internals in production.
  app.useGlobalFilters(new AllExceptionsFilter(config.isProduction));
}
