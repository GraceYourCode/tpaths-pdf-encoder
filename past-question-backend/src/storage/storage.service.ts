import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { LocalObjectStore } from './local-object-store.js';
import { S3ObjectStore, type S3Config } from './s3-object-store.js';
import type { ObjectStore } from './object-store.js';
import {
  decryptAtRest,
  developmentKeyring,
  encryptAtRest,
  parseMasterKeyring,
  type MasterKeyring,
} from '../common/utils/at-rest.js';

export class DocumentIntegrityError extends Error {
  constructor() {
    super('Stored document failed integrity verification');
    this.name = 'DocumentIntegrityError';
  }
}

export interface StoredDocument {
  key: string;
  /** SHA-256 of the plaintext PDF. */
  checksumSha256: string;
  /** SHA-256 of the stored (encrypted) object. */
  encryptedChecksumSha256: string;
  /** Master key version used to wrap this object's data key. */
  encryptionKeyVersion: string;
}

/**
 * Document storage facade. Originals are always encrypted at rest before they
 * reach the driver, and always integrity-checked after they are read back.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly store: ObjectStore;
  private readonly ring: MasterKeyring;

  constructor(private readonly config: ConfigService) {
    const driver = config.get<string>('storage.driver') ?? 'local';
    this.store =
      driver === 's3'
        ? new S3ObjectStore(config.getOrThrow<S3Config>('storage.s3'))
        : new LocalObjectStore(config.getOrThrow<string>('storage.localDir'));

    const raw = config.get<string>('security.documentMasterKeys') ?? '';
    const version = Number(config.get<string>('security.documentMasterKeyVersion') ?? 1);
    this.ring = raw
      ? parseMasterKeyring(raw, version)
      : developmentKeyring();
    if (!raw) this.logger.warn('DOCUMENT_MASTER_KEYS not set; using development keyring');
  }

  /** Encrypts a PDF and stores it under a private key. */
  async putPrivateDocument(key: string, plaintext: Buffer): Promise<StoredDocument> {
    const blob = encryptAtRest(plaintext, this.ring);
    await this.store.put(key, blob);
    return {
      key,
      checksumSha256: sha256Hex(plaintext),
      encryptedChecksumSha256: sha256Hex(blob),
      encryptionKeyVersion: String(blob.readUInt8(6)),
    };
  }

  /**
   * Reads and decrypts a stored PDF. Throws DocumentIntegrityError if the
   * decrypted bytes do not match the checksum recorded at upload.
   */
  async getPrivateDocument(key: string, expectedSha256: string): Promise<Buffer> {
    const blob = await this.store.get(key);
    let plain: Buffer;
    try {
      plain = decryptAtRest(blob, this.ring);
    } catch {
      throw new DocumentIntegrityError();
    }
    if (sha256Hex(plain) !== expectedSha256) throw new DocumentIntegrityError();
    return plain;
  }

  /** Readiness: can the configured object store be reached? */
  async ping(): Promise<boolean> {
    return this.store.ping();
  }

  get driverKind(): string {
    return this.store.kind;
  }
}

function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

