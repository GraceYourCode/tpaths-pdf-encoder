import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import type { AppConfig } from './config/configuration.js';
import { NodeEnv } from './config/env.validation.js';

describe('AppController', () => {
  let controller: AppController;

  const appConfig: AppConfig = {
    env: NodeEnv.Test,
    isProduction: false,
    port: 3000,
    apiPrefix: 'api',
    apiVersion: '1',
    corsOrigins: true,
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          // AppService reads only the 'app' config namespace.
          provide: ConfigService,
          useValue: {
            get: (key: string): unknown =>
              key === 'app' ? appConfig : undefined,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(AppController);
  });

  it('returns non-sensitive service metadata', () => {
    const info = controller.getServiceInfo();

    expect(info).toMatchObject({
      name: 'past-question-backend',
      status: 'running',
      environment: NodeEnv.Test,
      apiVersion: '1',
    });
  });

  it('does not leak secrets or internal fields', () => {
    const info = controller.getServiceInfo();

    // The descriptor is intentionally small; guard against accidental growth
    // that could expose configuration internals to unauthenticated callers.
    expect(Object.keys(info).sort()).toEqual([
      'apiVersion',
      'environment',
      'name',
      'status',
    ]);
  });
});
