/**
 * DatabaseModule
 *
 * Provides and exports the singleton `PrismaService`. Marked `@Global()` so
 * business modules can inject `PrismaService` without importing this module
 * everywhere. This is the seam through which all database access flows:
 *
 *   DatabaseModule -> PrismaService -> (application modules)
 */
import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
