import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApp } from './common/configure-app.js';
import type { AppConfig } from './config/configuration.js';

/**
 * Application entry point.
 *
 * Cross-cutting HTTP concerns (versioning, validation, security headers, error
 * envelope) are applied by the shared `configureApp` helper so that production
 * and the e2e test suite stay in lock-step. This file owns only the concerns
 * that are specific to a running server: logger selection, shutdown hooks, and
 * binding to a port.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Nest's built-in logger; structured per-request logging is added by
    // LoggingInterceptor. (Replaces the paid @nestjs/observe starter wiring.)
    logger: ['error', 'warn', 'log'],
  });

  const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

  configureApp(app, appConfig);

  // Clean shutdown so PrismaService.onModuleDestroy runs (closes DB pool).
  app.enableShutdownHooks();

  await app.listen(appConfig.port);

  new Logger('Bootstrap').log(
    `Application listening on http://localhost:${appConfig.port}/` +
      `${appConfig.apiPrefix}/v${appConfig.apiVersion}`,
  );
}

void bootstrap();
