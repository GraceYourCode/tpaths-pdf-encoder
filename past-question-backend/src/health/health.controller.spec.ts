import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let databaseHealthy: boolean;

  beforeEach(async () => {
    databaseHealthy = true;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          // Health checks depend only on PrismaService.isHealthy().
          provide: PrismaService,
          useValue: {
            isHealthy: (): Promise<boolean> => Promise.resolve(databaseHealthy),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  describe('liveness (GET /health)', () => {
    it('reports ok without touching the database', () => {
      const result = controller.check();

      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('readiness (GET /health/db)', () => {
    it('reports the database up when reachable', async () => {
      databaseHealthy = true;

      await expect(controller.checkDatabase()).resolves.toMatchObject({
        status: 'ok',
        database: 'up',
      });
    });

    it('degrades to error (does not throw) when the database is unreachable', async () => {
      databaseHealthy = false;

      await expect(controller.checkDatabase()).resolves.toMatchObject({
        status: 'error',
        database: 'down',
      });
    });
  });
});
