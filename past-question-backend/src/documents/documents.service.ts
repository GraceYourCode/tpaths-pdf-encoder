import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentStatus } from '../generated/prisma/browser.js';

const MAX_PDF_UPLOAD_BYTES = 25 * 1024 * 1024;
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}
  
  async create(productId: string, file: any, d: any, adminId: string) {
    if (!file || file.mimetype !== 'application/pdf')
      throw new BadRequestException('Only PDF files are allowed');
    const max = MAX_PDF_UPLOAD_BYTES;
    if (file.size > max) throw new BadRequestException('File too large');
    const magic = file.buffer.subarray(0, 5).toString('ascii');
    if (magic !== '%PDF-') throw new BadRequestException('Invalid PDF file');
    const latest = await (this.prisma as any).document.findFirst({
      where: { productId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;
    const key = `products/${productId}/documents/${crypto.randomUUID()}-${version}.pdf`;
    // Encrypted at rest before it reaches the object store.
    const stored = await this.storage.putPrivateDocument(key, file.buffer);
    const doc = await (this.prisma as any).document.create({
      data: {
        productId,
        title: d.title,
        version,
        storageKey: stored.key,
        mimeType: 'application/pdf',
        sizeBytes: file.size,
        checksumSha256: stored.checksumSha256,
        encryptedChecksumSha256: stored.encryptedChecksumSha256,
        encryptionKeyVersion: stored.encryptionKeyVersion,
        // Upload validation (MIME, size, PDF magic) is complete at this point.
        status: DocumentStatus.READY,
      },
    });
    await this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'Document',
      entityId: doc.id,
      metadata: { operation: 'create', productId },
    });
    return this.public(doc);
  }
  async list(productId: string, admin = false) {
    return (this.prisma as any).document.findMany({
      where: { productId, ...(!admin ? { status: DocumentStatus.READY } : {}) },
      select: {
        id: true,
        title: true,
        version: true,
        sizeBytes: true,
        checksumSha256: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { version: 'desc' },
    });
  }
  async get(id: string, admin = false) {
    const d = await (this.prisma as any).document.findUnique({ where: { id } });
    if (!d || (!admin && d.status !== DocumentStatus.READY))
      throw new NotFoundException('Document not found');
    return this.public(d);
  }
  async update(id: string, data: any, adminId: string) {
    const d = await this.get(id, true);
    const out = await (this.prisma as any).document.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
    await this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'Document',
      entityId: id,
      metadata: { operation: 'update' },
    });
    return this.public(out);
  }
  async remove(id: string, adminId: string) {
    await this.get(id, true);
    await (this.prisma as any).document.update({
      where: { id },
      data: { status: DocumentStatus.DISABLED },
    });
    await this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'Document',
      entityId: id,
      metadata: { operation: 'archive' },
    });
    return { archived: true };
  }
  private public(d: any) {
    const { storageKey, ...safe } = d;
    return safe;
  }

  async markDocumentAsReady(id: string) {
  return this.prisma.document.update({
    where: { id },
    data: { status: DocumentStatus.READY },
  });
}
}
