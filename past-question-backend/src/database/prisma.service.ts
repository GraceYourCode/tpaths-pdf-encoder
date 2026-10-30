/**
 * PrismaService — the single, injectable database client for the application.
 *
 * Extends the Prisma client (via the `prisma-client` seam) and ties its
 * connection lifecycle to Nest's module lifecycle so exactly one connection
 * pool exists per process. Future business modules (auth, users, products, …)
 * inject this service rather than constructing their own client.
 *
 * NOTE: Until `prisma generate` has been run and the real client activated in
 * `prisma-client.ts`, this service compiles and the app boots, but any actual
 * query (including `$connect`) throws a clear "client not generated" error.
 * `onModuleInit` therefore logs a warning and continues instead of crashing the
 * whole app, so the rest of the foundation (health, validation, security) can be
 * exercised without a database.
 */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { DatabaseConfig } from '../config/configuration.js';
import { createDatabaseAdapter, PrismaClientBase } from './prisma-client.js';

@Injectable()
export class PrismaService
  extends PrismaClientBase
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  constructor(configService: ConfigService) {
    const database = configService.get<DatabaseConfig>('database');
    const connectionString = database?.url ?? '';

    super({ adapter: createDatabaseAdapter(connectionString) as any });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.connected = true;
      this.logger.log('Database connection established');
    } catch (error) {
      // In the foundation phase the generated client / database may be absent.
      // Log and continue so the app can still boot and serve non-DB routes;
      // health checks will report the database as unavailable.
      this.connected = false;
      this.logger.warn(
        `Database connection not established: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } catch {
      // Nothing actionable during shutdown; avoid masking the original exit.
    }
  }

  /**
   * Lightweight connectivity probe for the health endpoint. Returns `false`
   * rather than throwing so a down database degrades the health response
   * instead of producing an unhandled 500.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
