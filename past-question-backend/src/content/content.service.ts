import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { encryptPdfToArtifact, randomToken, signJwt, verifyJwt } from '../common/utils/crypto.js';
import { StorageService } from '../storage/storage.service.js';
import { DocumentStatus } from '../generated/prisma/enums.js';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async authorize(
    userId: string,
    documentId: string,
    deviceId: string,
    ip?: string,
  ) {
    const d = await (this.prisma as any).document.findUnique({
      where: { id: documentId },
      include: { product: true },
    });
    if (!d || d.status !== 'ACTIVE')
      throw new NotFoundException('Document not found');
    const device = await (this.prisma as any).device.findUnique({
      where: { id: deviceId },
    });
    if (!device || device.userId !== userId || device.status !== 'ACTIVE')
      throw new ForbiddenException('Device not authorized');
    const l = await (this.prisma as any).license.findFirst({
      where: { userId, productId: d.productId, status: 'ACTIVE' },
    });
    if (
      !l ||
      l.product.status !== 'ACTIVE' ||
      (l.expiresAt && l.expiresAt <= new Date()) ||
      l.deviceId !== deviceId
    )
      throw new ForbiddenException('Content access not authorized');
    const exp = new Date(
      Date.now() +
        Number(this.config.get<string>('content.authorizationTtlMs') ?? 300000),
    );
    const token = signJwt(
      {
        sub: userId,
        doc: documentId,
        device: deviceId,
        license: l.id,
        jti: randomToken(12),
      },
      this.config.getOrThrow('security.contentSecret'),
      Math.floor((exp.getTime() - Date.now()) / 1000),
    );
    await (this.prisma as any).license.update({
      where: { id: l.id },
      data: { lastValidatedAt: new Date() },
    });
    await this.audit.log({
      userId,
      action: 'DOCUMENT_ACCESS',
      entityType: 'Document',
      entityId: documentId,
      ipAddress: ip,
      metadata: { licenseId: l.id, deviceId },
    });
    return {
      authorizationToken: token,
      expiresAt: exp.toISOString(),
      document: {
        id: d.id,
        title: d.title,
        version: d.version,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        checksumSha256: d.checksumSha256,
      },
      downloadEndpoint: `/api/v1/content/${d.id}/stream`,
    };
  }

  async stream(documentId: string, token: string) {
    let p: any;
    try {
      p = verifyJwt<any>(
        token,
        this.config.getOrThrow('security.contentSecret'),
      );
    } catch {
      throw new UnauthorizedException('Invalid content authorization');
    }
    if (p.doc !== documentId)
      throw new ForbiddenException('Invalid content authorization');
    const d = await (this.prisma as any).document.findUnique({
      where: { id: documentId },
    });
    if (!d || d.status !== 'ACTIVE')
      throw new NotFoundException('Document not found');
    const l = await (this.prisma as any).license.findUnique({
      where: { id: p.license },
    });
    if (
      !l ||
      l.userId !== p.sub ||
      l.deviceId !== p.device ||
      l.status !== 'ACTIVE' ||
      (l.expiresAt && l.expiresAt <= new Date())
    )
      throw new ForbiddenException('Content access not authorized');
    return this.storage.getPrivate(d.storageKey);
  }
  
  async getAuthorizedArtifact(documentId: string, contentToken: string) {
    const license = await this.prisma.license.findUnique({
      where: { id: contentToken }, 
      include: {
        product: {
          include: { documents: true }
        },
        purchase: true
      }
    });

    if (!license) throw new ForbiddenException('Invalid content token or license not found');

    if (license.purchase.status !== 'PAID') throw new ForbiddenException('Purchase not paid');
    if (license.status !== 'ACTIVE') throw new ForbiddenException('License is inactive or revoked');
    if (license.product.status !== 'ACTIVE') throw new ForbiddenException('Product is no longer available');
    
    if (!license.deviceId) throw new ForbiddenException('License is not bound to a device');

    const document = license.product.documents.find(doc => doc.id === documentId);
    if (!document) throw new NotFoundException('Document not found in authorized product');
    
    if (document.status !== DocumentStatus.READY) throw new ForbiddenException('Document is not ready for delivery');

    const rawPdfBuffer = await this.storage.getPrivate(document.storageKey);

    const encryptionKey = process.env.ARTIFACT_ENCRYPTION_KEY!; 
    const artifactBuffer = encryptPdfToArtifact (rawPdfBuffer, encryptionKey, license.deviceId);

    return { artifactBuffer, filename: document.title.replace(/\s+/g, '_') };
  }

}
