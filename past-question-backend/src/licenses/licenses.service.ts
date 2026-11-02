import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class LicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async activate(userId: string, d: any, ip?: string) {
    const hash = sha256(d.token);
    return (this.prisma as any).$transaction(async (tx: any) => {
      const t = await tx.activationToken.findUnique({
        where: { tokenHash: hash },
        include: { product: true },
      });
      if (
        !t ||
        t.status !== 'UNUSED' ||
        (t.expiresAt && t.expiresAt <= new Date()) ||
        t.product.status !== 'ACTIVE'
      )
        throw new ForbiddenException('Invalid activation token');
      const device = await tx.device.findUnique({ where: { id: d.deviceId } });
      if (!device || device.userId !== userId || device.status !== 'ACTIVE')
        throw new ForbiddenException('Device not authorized');
      const license = t.purchaseId
        ? await tx.license.findUnique({ where: { purchaseId: t.purchaseId } })
        : await tx.license.findFirst({
            where: { userId, productId: t.productId, status: 'ACTIVE' },
          });
      if (
        !license ||
        license.userId !== userId ||
        license.productId !== t.productId
      )
        throw new ForbiddenException('License not found');
      if (license.deviceId && license.deviceId !== device.id)
        throw new ConflictException(
          'License is already bound to another device',
        );

      const updated = await tx.license.update({
        where: { id: license.id },
        data: {
          deviceId: device.id,
          status: 'ACTIVE',
          activatedAt: new Date(),
          lastValidatedAt: new Date(),
          expiresAt: license.expiresAt ?? t.expiresAt,
        },
      });

      await tx.activationToken.update({
        where: { id: t.id },
        data: { status: 'ACTIVE', activatedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'TOKEN_ACTIVATED',
          entityType: 'ActivationToken',
          entityId: t.id,
          ipAddress: ip,
        },
      });
      return updated;
    });
  }

  async list(userId: string) {
    return (this.prisma as any).license.findMany({
      where: { userId },
      include: { product: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(userId: string, id: string) {
    const l = await (this.prisma as any).license.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            status: true,
            documents: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                title: true,
                version: true,
                sizeBytes: true,
                checksumSha256: true,
              },
            },
          },
        },
      },
    });

    if (!l || l.userId !== userId)
      throw new NotFoundException('License not found');
    return l;
  }

  async validate(userId: string, id: string, deviceId?: string) {
    const l = await this.get(userId, id);
    if (
      l.status !== 'ACTIVE' ||
      l.product.status !== 'ACTIVE' ||
      (l.expiresAt && l.expiresAt <= new Date()) ||
      (deviceId && l.deviceId !== deviceId)
    )
      return { valid: false };

    await (this.prisma as any).license.update({
      where: { id },
      data: { lastValidatedAt: new Date() },
    });
    return { valid: true, licenseId: id, expiresAt: l.expiresAt };
  }

  async adminList(q: any) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit || 20)));
    const where: any = {};
    if (q.status) where.status = q.status;
    const [items, total] = await Promise.all([
      (this.prisma as any).license.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          product: { select: { id: true, title: true } },
          purchase: { select: { reference: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).license.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async adminGet(id: string) {
    const l = await (this.prisma as any).license.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        product: true,
        purchase: true,
      },
    });
    if (!l) throw new NotFoundException('License not found');
    return l;
  }

  async setStatus(
    id: string,
    status: 'SUSPENDED' | 'REVOKED',
    adminId: string,
  ) {
    const l = await this.adminGet(id);
    const out = await (this.prisma as any).license.update({
      where: { id },
      data: { status },
    });
    await this.audit.log({
      userId: adminId,
      action: `LICENSE_${status}`,
      entityType: 'License',
      entityId: id,
    });
    return out;
  }
  
  async generateToken(
    productId: string,
    expiresAt?: Date,
    purchaseId?: string,
    db: any = this.prisma,
  ) {
    const raw = `PQ-${randomToken(18).toUpperCase()}`;
    const t = await (db as any).activationToken.create({
      data: {
        tokenHash: sha256(raw),
        productId,
        expiresAt,
        ...(purchaseId ? { purchaseId } : {}),
      },
    });
    return { id: t.id, token: raw, expiresAt: t.expiresAt };
  }
}
