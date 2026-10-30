import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

export type PrismaClientOptions = ConstructorParameters<typeof PrismaClient>[0];
export class PrismaClientBase extends PrismaClient {}

export function createDatabaseAdapter(connectionString: string): unknown {
  return new PrismaPg({ connectionString });
}
