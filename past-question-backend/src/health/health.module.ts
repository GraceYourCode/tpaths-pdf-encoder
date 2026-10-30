/**
 * HealthModule
 *
 * Exposes application and database health endpoints. Depends on the globally
 * provided `PrismaService` (via `DatabaseModule`) for the DB readiness probe.
 */
import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
