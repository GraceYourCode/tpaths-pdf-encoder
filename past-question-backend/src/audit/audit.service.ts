import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async log(input: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    metadata?: unknown;
  }) {
    await (this.prisma as any).auditLog.create({
      data: { ...input, metadata: input.metadata as any },
    });
  }
}
