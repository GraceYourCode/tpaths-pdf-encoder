/**
 * Data-key wrapping for document encryption at rest.
 *
 * Each document has a random 256-bit data key (DEK). A DekWrapper protects that
 * key. Two implementations exist:
 *
 *  - EnvDekWrapper: AES-256-GCM under a master key from configuration.
 *    Development and tests only. Production policy refuses it.
 *  - KmsDekWrapper: AWS KMS Encrypt/Decrypt. The master key never leaves KMS
 *    and every call is authorised by IAM and recorded in CloudTrail.
 *
 * `context` is authenticated by both implementations, so a wrapped key cannot
 * be moved to a different object.
 *
 * HSM: a CloudHSM or other PKCS#11 backend would be a third implementation of
 * this interface. None is implemented in this repository.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { signAwsRequest, type AwsCredentials } from '../common/utils/aws-sigv4.js';
import type { MasterKeyring } from '../common/utils/at-rest.js';

export const PROVIDER_ENV = 1;
export const PROVIDER_AWS_KMS = 2;

export interface WrappedKey {
  wrapped: Buffer;
  keyVersion: number;
}

export interface DekWrapper {
  readonly providerId: number;
  readonly name: 'env' | 'aws-kms';
  wrap(dek: Buffer, context: Buffer): Promise<WrappedKey>;
  unwrap(wrapped: Buffer, keyVersion: number, context: Buffer): Promise<Buffer>;
}

export class KeyProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyProviderError';
  }
}

export class EnvDekWrapper implements DekWrapper {
  readonly providerId = PROVIDER_ENV;
  readonly name = 'env' as const;

  constructor(private readonly ring: MasterKeyring) {}

  async wrap(dek: Buffer, context: Buffer): Promise<WrappedKey> {
    const key = this.ring.keys.get(this.ring.activeVersion);
    if (!key) throw new KeyProviderError('Active master key missing');
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    c.setAAD(context);
    const ct = Buffer.concat([c.update(dek), c.final()]);
    return {
      wrapped: Buffer.concat([iv, c.getAuthTag(), ct]),
      keyVersion: this.ring.activeVersion,
    };
  }

  async unwrap(wrapped: Buffer, keyVersion: number, context: Buffer): Promise<Buffer> {
    const key = this.ring.keys.get(keyVersion);
    if (!key) throw new KeyProviderError(`Master key version ${keyVersion} is not configured`);
    if (wrapped.length !== 60) throw new KeyProviderError('Malformed wrapped key');
    const d = createDecipheriv('aes-256-gcm', key, wrapped.subarray(0, 12), { authTagLength: 16 });
    d.setAAD(context);
    d.setAuthTag(wrapped.subarray(12, 28));
    return Buffer.concat([d.update(wrapped.subarray(28)), d.final()]);
  }
}

export interface KmsConfig {
  keyId: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export class KmsDekWrapper implements DekWrapper {
  readonly providerId = PROVIDER_AWS_KMS;
  readonly name = 'aws-kms' as const;

  constructor(
    private readonly cfg: KmsConfig,
    private readonly transport: Transport = (url, init) => fetch(url, init),
  ) {
    if (!cfg.endpoint.startsWith('https://')) throw new KeyProviderError('KMS endpoint must use https');
    if (!cfg.keyId || !cfg.region) throw new KeyProviderError('KMS key id and region are required');
  }

  async wrap(dek: Buffer, context: Buffer): Promise<WrappedKey> {
    const res = await this.call('Encrypt', {
      KeyId: this.cfg.keyId,
      Plaintext: dek.toString('base64'),
      EncryptionContext: this.encryptionContext(context),
    });
    const blob = Buffer.from(String(res.CiphertextBlob ?? ''), 'base64');
    if (blob.length === 0) throw new KeyProviderError('KMS returned no ciphertext');
    return { wrapped: blob, keyVersion: 0 };
  }

  async unwrap(wrapped: Buffer, _keyVersion: number, context: Buffer): Promise<Buffer> {
    const res = await this.call('Decrypt', {
      CiphertextBlob: wrapped.toString('base64'),
      EncryptionContext: this.encryptionContext(context),
    });
    const dek = Buffer.from(String(res.Plaintext ?? ''), 'base64');
    if (dek.length !== 32) throw new KeyProviderError('KMS returned an unexpected key length');
    return dek;
  }

  private encryptionContext(context: Buffer): Record<string, string> {
    return {
      purpose: 'tpaths-document-dek',
      bind: createHash('sha256').update(context).digest('hex'),
    };
  }

  private async call(op: 'Encrypt' | 'Decrypt', payload: Record<string, unknown>): Promise<any> {
    const url = new URL(this.cfg.endpoint);
    const body = Buffer.from(JSON.stringify(payload));
    const headers = signAwsRequest({
      service: 'kms',
      region: this.cfg.region,
      credentials: { accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey } as AwsCredentials,
      method: 'POST',
      host: url.host,
      path: '/',
      headers: {
        'content-type': 'application/x-amz-json-1.1',
        'x-amz-target': `TrentService.${op}`,
      },
      body,
      now: new Date(),
    });
    let r: Response;
    try {
      r = await this.transport(`${url.origin}/`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new KeyProviderError('KMS is unreachable');
    }
    if (!r.ok) throw new KeyProviderError(`KMS ${op} failed with status ${r.status}`);
    return r.json();
  }
}
