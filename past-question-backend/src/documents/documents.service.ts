import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { StorageService, DocumentIntegrityError } from '../storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentStatus } from '../generated/prisma/browser.js';

const MAX_PDF_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Document lifecycle
 *
 *   create  -> PROCESSING  (record written, object not yet stored)
 *           -> stored      (encrypted object written, metadata recorded)
 *           -> READY       (read-back verified; previous READY version of the
 *                           same series set to DISABLED in the SAME transaction)
 *   any failure -> FAILED with failureReason, or left PROCESSING for retry
 *   retry   -> re-runs activation for PROCESSING or 'activation_failed' records
 *   DISABLED -> READY via PATCH (re-activation, same atomic swap)
 *   DELETE  -> DELETED (tombstone; object removed; terminal)
 *
 * failureReason values:
 *   storage_write_failed   no object exists; re-upload required
 *   integrity_check_failed object exists but does not verify; re-upload required
 *   activation_failed      object verified; database activation failed; retry allowed
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async create(productId: string, file: any, d: any, adminId: string, replacesDocumentId?: string) {
    if (!file || file.mimetype !== 'application/pdf')
      throw new BadRequestException('Only PDF files are allowed');
    if (!file.buffer || file.size > MAX_PDF_UPLOAD_BYTES)
      throw new BadRequestException('File too large');
    if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-')
      throw new BadRequestException('Invalid PDF file');

    const product = await (this.prisma as any).product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    let seriesId = randomUUID();
    if (replacesDocumentId) {
      const prev = await (this.prisma as any).document.findUnique({ where: { id: replacesDocumentId } });
      if (!prev || prev.productId !== productId) throw new NotFoundException('Document to replace not found');
      if (prev.status === DocumentStatus.DELETED)
        throw new ConflictException('Cannot replace a deleted document');
      seriesId = prev.seriesId;
    }

    const doc = await this.allocateRecord(productId, seriesId, d.title, file.buffer);

    // Step 2: encrypted object. On failure the record is FAILED and nothing is stored.
    try {
      const stored = await this.storage.putPrivateDocument(doc.storageKey, file.buffer);
      await (this.prisma as any).document.update({
        where: { id: doc.id },
        data: {
          encryptedSizeBytes: stored.encryptedSizeBytes,
          encryptedChecksumSha256: stored.encryptedChecksumSha256,
          encryptionKeyVersion: stored.encryptionKeyVersion,
        },
      });
    } catch (error) {
      this.logger.error(`Document ${doc.id} storage write failed`);
      await this.markFailed(doc.id, 'storage_write_failed');
      await this.auditOp(adminId, doc.id, 'upload_failed', { reason: 'storage_write_failed' });
      throw new ServiceUnavailableException('Document storage is unavailable; the upload was not saved');
    }

    return this.activate(doc.id, adminId, 'create');
  }

  /** Retries activation of an upload whose object is stored but not yet READY. */
  async retry(id: string, adminId: string) {
    const doc = await this.findOrThrow(id);
    const retryable =
      doc.status === DocumentStatus.PROCESSING ||
      (doc.status === DocumentStatus.FAILED && doc.failureReason === 'activation_failed');
    if (!retryable) {
      if (doc.status === DocumentStatus.FAILED)
        throw new ConflictException('This upload cannot be retried; upload the document again');
      throw new ConflictException('Document is not awaiting processing');
    }
    return this.activate(id, adminId, 'retry');
  }

  /**
   * Verifies the stored object, then makes this version READY and disables the
   * previous READY version of the same series in one transaction. The partial
   * unique index guarantees at most one READY version even under concurrency.
   */
  private async activate(id: string, adminId: string, operation: string) {
    const doc = await this.findOrThrow(id);

    try {
      await this.storage.getPrivateDocument(doc.storageKey, doc.checksumSha256);
    } catch (error) {
      const reason = error instanceof DocumentIntegrityError ? 'integrity_check_failed' : 'activation_failed';
      await this.markFailed(id, reason);
      await this.auditOp(adminId, id, 'activation_failed', { reason });
      if (reason === 'integrity_check_failed')
        throw new UnprocessableEntityException('Stored document failed verification; upload it again');
      throw new ServiceUnavailableException('Document could not be verified right now; retry shortly');
    }

    let out: any;
    try {
      out = await (this.prisma as any).$transaction(async (tx: any) => {
        const superseded = await tx.document.updateMany({
          where: { seriesId: doc.seriesId, status: DocumentStatus.READY, id: { not: id } },
          data: { status: DocumentStatus.DISABLED },
        });
        const activated = await tx.document.update({
          where: { id },
          data: { status: DocumentStatus.READY, processedAt: new Date(), failureReason: null },
        });
        return { activated, supersededCount: superseded.count };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        await this.markFailed(id, 'activation_failed');
        throw new ConflictException('Another version of this document was activated at the same time; retry');
      }
      await this.markFailed(id, 'activation_failed');
      await this.auditOp(adminId, id, 'activation_failed', { reason: 'activation_failed' });
      throw new ServiceUnavailableException('Document could not be activated right now; retry shortly');
    }

    await this.auditOp(adminId, id, operation, { supersededCount: out.supersededCount });
    return this.public(out.activated);
  }

  async list(productId: string, admin = false) {
    return (this.prisma as any).document.findMany({
      where: { productId, ...(!admin ? { status: DocumentStatus.READY } : {}) },
      select: {
        id: true,
        title: true,
        version: true,
        seriesId: true,
        sizeBytes: true,
        checksumSha256: true,
        status: true,
        failureReason: true,
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

  /**
   * Title changes and status changes. READY is reached only through activation
   * (which replaces the previous version). DELETED is set only by remove().
   */
  async update(id: string, data: any, adminId: string) {
    const doc = await this.findOrThrow(id);
    if (doc.status === DocumentStatus.DELETED)
      throw new ConflictException('Deleted documents cannot be changed');
    if (data.status === DocumentStatus.DELETED)
      throw new BadRequestException('Use DELETE to remove a document');

    if (data.status === DocumentStatus.READY && doc.status !== DocumentStatus.READY) {
      if (doc.status !== DocumentStatus.DISABLED)
        throw new ConflictException('Only disabled documents can be re-enabled; retry failed uploads instead');
      if (data.title !== undefined) await this.setTitle(id, data.title);
      return this.activate(id, adminId, 'enable');
    }

    const out = await (this.prisma as any).document.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.status === DocumentStatus.DISABLED ? { status: DocumentStatus.DISABLED } : {}),
      },
    });
    await this.auditOp(adminId, id, 'update', {
      status: data.status ?? null,
      titleChanged: data.title !== undefined,
    });
    return this.public(out);
  }

  /** Tombstone: status DELETED (terminal) and the stored object is removed. */
  async remove(id: string, adminId: string) {
    const doc = await this.findOrThrow(id);
    if (doc.status === DocumentStatus.DELETED) return { deleted: true };

    await (this.prisma as any).document.update({
      where: { id },
      data: { status: DocumentStatus.DELETED, failureReason: 'deleted' },
    });
    try {
      await this.storage.deleteObject(doc.storageKey);
    } catch {
      // Status is already DELETED, so the object can no longer be delivered.
      await this.auditOp(adminId, id, 'object_delete_failed', {});
      this.logger.error(`Object removal failed for deleted document ${id}`);
    }
    await this.auditOp(adminId, id, 'delete', {});
    return { deleted: true };
  }

  private async allocateRecord(productId: string, seriesId: string, title: string, buffer: Buffer) {
    // Version numbers are unique per product; retry on a concurrent allocation.
    for (let attempt = 0; attempt < 5; attempt++) {
      const latest = await (this.prisma as any).document.findFirst({
        where: { productId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;
      const key = `products/${productId}/documents/${randomUUID()}-v${version}.pdf`;
      try {
        return await (this.prisma as any).document.create({
          data: {
            productId,
            seriesId,
            title,
            version,
            storageKey: key,
            mimeType: 'application/pdf',
            sizeBytes: buffer.length,
            checksumSha256: createHash('sha256').update(buffer).digest('hex'),
            status: DocumentStatus.PROCESSING,
          },
        });
      } catch (error: any) {
        if (error?.code !== 'P2002' || attempt === 4) throw error;
      }
    }
    throw new ConflictException('Could not allocate a document version; retry');
  }

  private async setTitle(id: string, title: string) {
    await (this.prisma as any).document.update({ where: { id }, data: { title } });
  }

  private async markFailed(id: string, reason: string) {
    await (this.prisma as any).document.update({
      where: { id },
      data: { status: DocumentStatus.FAILED, failureReason: reason },
    });
  }

  private async findOrThrow(id: string) {
    const doc = await (this.prisma as any).document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  private auditOp(adminId: string, documentId: string, operation: string, metadata: Record<string, unknown>) {
    return this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'Document',
      entityId: documentId,
      metadata: { operation, ...metadata },
    });
  }

  private public(d: any) {
    const { storageKey, ...safe } = d;
    return safe;
  }
}
