import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { AuditService } from '../audit/audit.service.js';

const LICENSE_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'];

/** Validated page/limit parsing shared by admin list endpoints. */
export function parsePaging(q: any): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Math.floor(Number(q?.page ?? 1)) || 1);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(q?.limit ?? 20)) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** Parses optional `from`/`to` ISO dates into a createdAt range. */
export function parseDateRange(q: any): { gte?: Date; lte?: Date } | undefined {
  if (!q?.from && !q?.to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (q.from) {
    const d = new Date(String(q.from));
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid from date');
    range.gte = d;
  }
  if (q.to) {
    const d = new Date(String(q.to));
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid to date');
    range.lte = d;
  }
  return range;
}

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
      if (license.status !== 'ACTIVE')
        throw new ForbiddenException('License is not active');
      if (license.expiresAt && license.expiresAt <= new Date())
        throw new ForbiddenException('License has expired');
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
              where: { status: 'READY' },
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

    if (l.deviceId) {
      const device = await (this.prisma as any).device.findUnique({
        where: { id: l.deviceId },
      });
      if (!device || device.status !== 'ACTIVE') return { valid: false };
    }
    const owner = await (this.prisma as any).user.findUnique({
      where: { id: l.userId },
      select: { status: true },
    });
    if (!owner || owner.status !== 'ACTIVE') return { valid: false };

    await (this.prisma as any).license.update({
      where: { id },
      data: { lastValidatedAt: new Date() },
    });
    return { valid: true, licenseId: id, expiresAt: l.expiresAt };
  }

  async adminList(q: any) {
    const { page, limit, skip } = parsePaging(q);
    const where: any = {};
    if (q.status !== undefined) {
      if (!LICENSE_STATUSES.includes(q.status))
        throw new BadRequestException('Invalid license status');
      where.status = q.status;
    }
    if (q.userId) where.userId = String(q.userId);
    if (q.productId) where.productId = String(q.productId);
    if (q.deviceId) where.deviceId = String(q.deviceId);
    const range = parseDateRange(q);
    if (range) where.createdAt = range;
    const [items, total] = await Promise.all([
      (this.prisma as any).license.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          product: { select: { id: true, title: true } },
          purchase: { select: { id: true, reference: true, status: true } },
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

  /**
   * Allowed transitions:
   *   ACTIVE    -> SUSPENDED | REVOKED
   *   SUSPENDED -> ACTIVE    | REVOKED
   *   REVOKED   -> (none)
   */
  async setStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED',
    adminId: string,
  ) {
    const l = await this.adminGet(id);
    const allowed: Record<string, string[]> = {
      ACTIVE: ['SUSPENDED', 'REVOKED'],
      SUSPENDED: ['ACTIVE', 'REVOKED'],
      REVOKED: [],
      EXPIRED: [],
    };
    if (!(allowed[l.status] ?? []).includes(status))
      throw new ConflictException(`License cannot change from ${l.status} to ${status}`);
    const out = await (this.prisma as any).license.update({
      where: { id },
      data: { status },
    });
    await this.audit.log({
      userId: adminId,
      action: `LICENSE_${status}`,
      entityType: 'License',
      entityId: id,
      metadata: { from: l.status },
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
