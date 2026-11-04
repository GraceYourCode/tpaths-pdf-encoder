import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { LocalObjectStore } from './local-object-store.js';
import { S3ObjectStore, type S3Config } from './s3-object-store.js';
import type { ObjectStore } from './object-store.js';
import {
  decryptAtRest,
  developmentKeyring,
  parseMasterKeyring,
  type MasterKeyring,
} from '../common/utils/at-rest.js';
import { encryptEnvelopeV2, decryptEnvelopeV2 } from '../common/utils/envelope-v2.js';
import {
  EnvDekWrapper,
  KmsDekWrapper,
  PROVIDER_AWS_KMS,
  PROVIDER_ENV,
  type DekWrapper,
  type KmsConfig,
} from './dek-wrapper.js';

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
  encryptedSizeBytes: number;
  /** Provider and key version used, e.g. "aws-kms:0" or "env:1". */
  encryptionKeyVersion: string;
}

/**
 * Document storage facade. Originals are encrypted before they reach the object
 * store and integrity-checked when read back.
 *
 * Writes always use the configured provider (AWS KMS in production). Reads accept
 * any provider still configured, so objects remain readable across rotation.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly store: ObjectStore;
  private readonly activeWrapper: DekWrapper;
  private readonly wrappers = new Map<number, DekWrapper>();
  private readonly legacyRing: MasterKeyring;

  constructor(private readonly config: ConfigService) {
    const driver = config.get<string>('storage.driver') ?? 'local';
    this.store =
      driver === 's3'
        ? new S3ObjectStore(config.getOrThrow<S3Config>('storage.s3'))
        : new LocalObjectStore(config.getOrThrow<string>('storage.localDir'));

    const raw = config.get<string>('security.documentMasterKeys') ?? '';
    const version = Number(config.get<string>('security.documentMasterKeyVersion') ?? 1);
    this.legacyRing = raw ? parseMasterKeyring(raw, version) : developmentKeyring();

    const env = new EnvDekWrapper(this.legacyRing);
    const provider = config.get<string>('security.documentKeyProvider') ?? 'env';
    if (provider === 'aws-kms') {
      const kms = new KmsDekWrapper(config.getOrThrow<KmsConfig>('security.kms'));
      this.activeWrapper = kms;
      this.wrappers.set(PROVIDER_AWS_KMS, kms);
      this.wrappers.set(PROVIDER_ENV, env);
    } else {
      this.logger.warn('Document key provider is "env" (development only)');
      this.activeWrapper = env;
      this.wrappers.set(PROVIDER_ENV, env);
    }
  }

  /** Encrypts a PDF and stores it under a private key. */
  async putPrivateDocument(key: string, plaintext: Buffer): Promise<StoredDocument> {
    const blob = await encryptEnvelopeV2(plaintext, this.activeWrapper);
    await this.store.put(key, blob);
    return {
      key,
      checksumSha256: sha256Hex(plaintext),
      encryptedChecksumSha256: sha256Hex(blob),
      encryptedSizeBytes: blob.length,
      encryptionKeyVersion: `${this.activeWrapper.name}:${blob.readUInt8(7)}`,
    };
  }

  /**
   * Reads and decrypts a stored PDF. Throws DocumentIntegrityError if the object
   * does not authenticate or the decrypted bytes do not match the upload checksum.
   */
  async getPrivateDocument(key: string, expectedSha256: string): Promise<Buffer> {
    const blob = await this.store.get(key);
    let plain: Buffer;
    try {
      plain = blob.length > 5 && blob.readUInt8(5) === 1
        ? decryptAtRest(blob, this.legacyRing)
        : await decryptEnvelopeV2(blob, this.wrappers);
    } catch (error) {
      if (error instanceof Error && error.name === 'KeyProviderError') throw error;
      throw new DocumentIntegrityError();
    }
    if (sha256Hex(plain) !== expectedSha256) throw new DocumentIntegrityError();
    return plain;
  }

  /** Removes a stored object (used when a document is tombstoned). */
  async deleteObject(key: string): Promise<void> {
    await this.store.delete(key);
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
