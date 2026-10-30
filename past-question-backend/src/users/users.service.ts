import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { hashPassword } from '../common/utils/crypto.js';
import { AuditService } from '../audit/audit.service.js';
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  private safe(u: any) {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      status: u.status,
      emailVerifiedAt: u.emailVerifiedAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      whatsapp: u.whatsapp,
    };
  }

  async me(id: string) {
    const u = await (this.prisma as any).user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    return this.safe(u);
  }
  
  async update(id: string, d: any) {
    const u = await (this.prisma as any).user.update({
      where: { id },
      data: {
        ...(d.firstName !== undefined ? { firstName: d.firstName } : {}),
        ...(d.lastName !== undefined ? { lastName: d.lastName } : {}),
        ...(d.password ? { passwordHash: await hashPassword(d.password) } : {}),
      },
    });
    if (d.password) {
      await (this.prisma as any).session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({ userId: id, action: 'PASSWORD_CHANGED' });
    }
    return this.safe(u);
  }

  async licenses(id: string) {
    return (this.prisma as any).license.findMany({
      where: { userId: id },
      include: {
        product: { select: { id: true, title: true, status: true } },
        purchase: { select: { reference: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async purchases(id: string) {
    return (this.prisma as any).purchase.findMany({
      where: { userId: id },
      include: {
        product: { select: { id: true, title: true, status: true } },
        payment: {
          select: {
            reference: true,
            status: true,
            currency: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async devices(id: string) {
    return (this.prisma as any).device.findMany({
      where: { userId: id },
      select: {
        id: true,
        platform: true,
        appVersion: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
  }
}
