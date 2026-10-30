/**
 * HealthController
 *
 * Liveness and readiness endpoints under `/api/v1/health`.
 *
 *   GET /api/v1/health      -> liveness: the process is up and serving.
 *   GET /api/v1/health/db   -> readiness: can the app reach PostgreSQL?
 *
 * Responses are small and machine-readable for uptime checks and load
 * balancers. The DB probe reports `status: 'error'` (HTTP 503) instead of
 * throwing, so a database outage produces a clear signal rather than a generic
 * 500. A hand-rolled check is used here because `@nestjs/terminus` is not a
 * dependency of this project; it can be adopted later without changing the
 * routes.
 */
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../common/decorators/auth.decorator.js';

import { PrismaService } from '../database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): { status: 'ok'; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('db')
  async checkDatabase(): Promise<{
    status: 'ok' | 'error';
    database: 'up' | 'down';
    timestamp: string;
  }> {
    const healthy = await this.prisma.isHealthy();
    return {
      status: healthy ? 'ok' : 'error',
      database: healthy ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
