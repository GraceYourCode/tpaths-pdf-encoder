import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { sha256 } from '../common/utils/crypto.js';
import { decodeDevicePublicKeyBase64, PqeError } from '../common/utils/pqe.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * Device identity and revocation.
 *
 * - Registration rejects an invalid public key with 400. Nothing is stored.
 * - A revoked device cannot be re-activated by registering again.
 * - A registered public key cannot be replaced; the device must be revoked.
 * - Revocation by the owner or an administrator is recorded with a timestamp
 *   and reason. Artifact delivery requires ACTIVE status on every request.
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private hash(raw: string) {
    return sha256(`${this.config.getOrThrow<string>('security.deviceHashPepper')}:${raw}`);
  }

  async list(userId: string) {
    return (this.prisma as any).device.findMany({
      where: { userId },
      select: { id: true, platform: true, appVersion: true, status: true, lastSeenAt: true, createdAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async register(userId: string, d: any, ip?: string) {
    const deviceHash = this.hash(d.deviceId);
    const existing = await (this.prisma as any).device.findUnique({
      where: { userId_deviceHash: { userId, deviceHash } },
    });

    if (existing?.status === 'REVOKED')
      throw new ForbiddenException('This device has been revoked');

    let publicKey: string;
    try {
      publicKey = decodeDevicePublicKeyBase64(d.publicKey ?? '').toString('base64');
    } catch (error) {
      const reason = error instanceof PqeError ? error.message : 'Invalid device public key';
      throw new BadRequestException(
        `${reason}. The device key must be a P-256 public key in base64 DER SubjectPublicKeyInfo format.`,
      );
    }

    if (existing?.publicKey && existing.publicKey !== publicKey)
      throw new ConflictException('Device already has a registered public key; replacement requires revocation');

    const device = await (this.prisma as any).device.upsert({
      where: { userId_deviceHash: { userId, deviceHash } },
      create: { userId, deviceHash, platform: d.platform, appVersion: d.appVersion, publicKey },
      update: {
        platform: d.platform,
        appVersion: d.appVersion,
        lastSeenAt: new Date(),
        publicKey: existing?.publicKey ?? publicKey,
      },
    });

    await this.audit.log({
      userId,
      action: 'DEVICE_BOUND',
      entityType: 'Device',
      entityId: device.id,
      ipAddress: ip,
    });
    return { ...this.safe(device), publicKeyRegistered: true };
  }

  async revoke(userId: string, id: string) {
    const d = await (this.prisma as any).device.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Device not found');
    if (d.userId !== userId) throw new ForbiddenException('Forbidden');
    await this.revokeRecord(id, 'owner_request');
    await this.audit.log({ userId, action: 'DEVICE_REVOKED', entityType: 'Device', entityId: id });
    return { revoked: true };
  }

  /** Administrative revocation of any user's device. */
  async adminRevoke(deviceId: string, adminId: string, reason: string) {
    const d = await (this.prisma as any).device.findUnique({ where: { id: deviceId } });
    if (!d) throw new NotFoundException('Device not found');
    if (d.status === 'REVOKED') return { revoked: true, alreadyRevoked: true };
    await this.revokeRecord(deviceId, reason);
    await this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'Device',
      entityId: deviceId,
      metadata: { operation: 'revoke', reason, deviceOwnerId: d.userId },
    });
    return { revoked: true, alreadyRevoked: false };
  }

  async validate(userId: string, id: string) {
    const d = await (this.prisma as any).device.findUnique({ where: { id } });
    if (!d || d.userId !== userId || d.status !== 'ACTIVE')
      throw new ForbiddenException('Device not authorized');
    await (this.prisma as any).device.update({ where: { id }, data: { lastSeenAt: new Date() } });
    return { valid: true };
  }

  private revokeRecord(id: string, reason: string) {
    return (this.prisma as any).device.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason },
    });
  }

  safe(d: any) {
    return {
      id: d.id,
      platform: d.platform,
      appVersion: d.appVersion,
      status: d.status,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
    };
  }
}
