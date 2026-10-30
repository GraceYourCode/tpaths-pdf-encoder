import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async dashboard() {
    const [
      students,
      activeStudents,
      products,
      activeProducts,
      licenses,
      activeLicenses,
      tokens,
      activeTokens,
      purchases,
      recentActivity,
    ] = await Promise.all([
      (this.prisma as any).user.count({ where: { role: 'STUDENT' } }),
      (this.prisma as any).user.count({
        where: { role: 'STUDENT', status: 'ACTIVE' },
      }),
      (this.prisma as any).product.count(),
      (this.prisma as any).product.count({ where: { status: 'ACTIVE' } }),
      (this.prisma as any).license.count(),
      (this.prisma as any).license.count({ where: { status: 'ACTIVE' } }),
      (this.prisma as any).activationToken.count(),
      (this.prisma as any).activationToken.count({
        where: { status: { in: ['UNUSED', 'ACTIVE'] } },
      }),
      (this.prisma as any).purchase.count({ where: { status: 'PAID' } }),
      (this.prisma as any).auditLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          userId: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      students: { total: students, active: activeStudents },
      products: { total: products, active: activeProducts },
      licenses: { total: licenses, active: activeLicenses },
      tokens: { total: tokens, active: activeTokens },
      purchases: { paid: purchases },
      recentActivity,
    };
  }

  async students(q: any) {
    const page = Math.max(1, Number(q.page || 1)),
      limit = Math.min(100, Math.max(1, Number(q.limit || 20)));
    const where: any = { role: 'STUDENT' };
    if (q.search)
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
      ];
    if (q.status) where.status = q.status;
    const [items, total] = await Promise.all([
      (this.prisma as any).user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).user.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async student(id: string) {
    const u = await (this.prisma as any).user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        licenses: {
          select: { id: true, status: true, productId: true, createdAt: true },
        },
        purchases: {
          select: {
            id: true,
            reference: true,
            status: true,
            productId: true,
            createdAt: true,
          },
        },
        devices: {
          select: {
            id: true,
            platform: true,
            appVersion: true,
            status: true,
            lastSeenAt: true,
          },
        },
      },
    });
    if (!u || u.role !== 'STUDENT')
      throw new NotFoundException('Student not found');
    return u;
  }

  async status(id: string, status: string, adminId: string) {
    const u = await this.student(id);
    const out = await (this.prisma as any).user.update({
      where: { id },
      data: { status },
    });
    if (status !== 'ACTIVE')
      await (this.prisma as any).session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    await this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'User',
      entityId: id,
      metadata: { operation: 'status', status },
    });
    return { id: out.id, status: out.status };
  }

  async auditLogs(q: any) {
    return (this.prisma as any).auditLog.findMany({
      take: Math.min(100, Number(q.limit || 50)),
      orderBy: { createdAt: 'desc' },
    });
  }
  
  async tokens(q: any) {
    return (this.prisma as any).activationToken.findMany({
      take: Math.min(100, Number(q.limit || 50)),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        productId: true,
        purchaseId: true,
        status: true,
        expiresAt: true,
        activatedAt: true,
        createdAt: true,
      },
    });
  }

  async token(id: string) {
    const t = await (this.prisma as any).activationToken.findUnique({
      where: { id },
      select: {
        id: true,
        productId: true,
        purchaseId: true,
        status: true,
        expiresAt: true,
        activatedAt: true,
        createdAt: true,
      },
    });
    if (!t) throw new NotFoundException('Token not found');
    return t;
  }
  
  async tokenStatus(
    id: string,
    status: 'SUSPENDED' | 'REVOKED',
    adminId: string,
  ) {
    const t = await this.token(id);
    const out = await (this.prisma as any).activationToken.update({
      where: { id },
      data: { status },
    });
    await this.audit.log({
      userId: adminId,
      action: `TOKEN_${status}`,
      entityType: 'ActivationToken',
      entityId: id,
    });
    return out;
  }
}
