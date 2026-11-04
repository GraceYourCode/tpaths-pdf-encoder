import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let databaseHealthy: boolean;
  let storageHealthy: boolean;

  beforeEach(async () => {
    databaseHealthy = true;
    storageHealthy = true;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          // Health checks depend on PrismaService.isHealthy().
          provide: PrismaService,
          useValue: {
            isHealthy: (): Promise<boolean> => Promise.resolve(databaseHealthy),
          },
        },
        {
          // Readiness also depends on object storage reachability.
          provide: StorageService,
          useValue: {
            ping: (): Promise<boolean> => Promise.resolve(storageHealthy),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  const fakeResponse = () => {
    const res = { statusCode: 200, status: (code: number) => ((res.statusCode = code), res) };
    return res as any;
  };

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

  describe('full readiness (GET /health/ready)', () => {
    it('returns 200 when database and storage are up', async () => {
      const res = fakeResponse();
      const body = await controller.ready(res);

      expect(res.statusCode).toBe(200);
      expect(body).toMatchObject({ status: 'ok', database: 'up', storage: 'up' });
    });

    it('returns 503 when storage is unreachable', async () => {
      storageHealthy = false;
      const res = fakeResponse();
      const body = await controller.ready(res);

      expect(res.statusCode).toBe(503);
      expect(body).toMatchObject({ status: 'error', database: 'up', storage: 'down' });
    });

    it('returns 503 when the database is unreachable', async () => {
      databaseHealthy = false;
      const res = fakeResponse();
      const body = await controller.ready(res);

      expect(res.statusCode).toBe(503);
      expect(body).toMatchObject({ status: 'error', database: 'down' });
    });
  });
});
