/**
 * S3-compatible object store using AWS Signature Version 4 with node:crypto.
 *
 * Path-style addressing (https://<endpoint>/<bucket>/<key>) so that the same
 * driver works with AWS S3, Cloudflare R2, MinIO and other compatible services.
 * Objects are written with server-side encryption (AES256) requested explicitly.
 *
 * Status: signing follows the SigV4 specification. It has NOT yet been verified
 * against a live bucket in this repository; see docs/deployment.md for the
 * manual verification steps.
 */
import { createHash, createHmac } from 'node:crypto';
import { ObjectNotFoundError, type ObjectStore } from './object-store.js';

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const TIMEOUT_MS = 20000;

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

/** RFC 3986 encoding as required by SigV4 (encodes ! ' ( ) * too). */
function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export class S3ObjectStore implements ObjectStore {
  readonly kind = 's3' as const;
  private readonly base: URL;

  constructor(private readonly cfg: S3Config) {
    this.base = new URL(cfg.endpoint);
    if (this.base.protocol !== 'https:') throw new Error('S3 endpoint must use https');
  }

  private objectPath(key: string): string {
    return `/${encodeRfc3986(this.cfg.bucket)}/${key.split('/').map(encodeRfc3986).join('/')}`;
  }

  /** Builds SigV4 headers for a request. */
  private sign(method: string, path: string, body: Buffer, extra: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(body);
    const host = this.base.host;

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k.toLowerCase(), v])),
    };
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((n) => `${n}:${headers[n].trim()}\n`).join('');
    const signedHeaders = names.join(';');
    const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

    const scope = `${dateStamp}/${this.cfg.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
    const kDate = hmac('AWS4' + this.cfg.secretAccessKey, dateStamp);
    const kRegion = hmac(kDate, this.cfg.region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.cfg.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const outgoing: Record<string, string> = { ...headers, authorization };
    delete outgoing.host; // fetch sets Host itself
    return outgoing;
  }

  private url(path: string): string {
    return `${this.base.origin}${path}`;
  }

  private async send(method: string, path: string, body: Buffer, extra: Record<string, string> = {}) {
    return fetch(this.url(path), {
      method,
      headers: this.sign(method, path, body, extra),
      body: body.length > 0 ? body : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  async put(key: string, data: Buffer): Promise<void> {
    const r = await this.send('PUT', this.objectPath(key), data, {
      'content-type': 'application/octet-stream',
      'x-amz-server-side-encryption': 'AES256',
    });
    if (!r.ok) throw new Error(`Object store PUT failed with status ${r.status}`);
  }

  async get(key: string): Promise<Buffer> {
    const r = await this.send('GET', this.objectPath(key), Buffer.alloc(0));
    if (r.status === 404) throw new ObjectNotFoundError(key);
    if (!r.ok) throw new Error(`Object store GET failed with status ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }

  async ping(): Promise<boolean> {
    try {
      const r = await this.send('HEAD', `/${encodeRfc3986(this.cfg.bucket)}`, Buffer.alloc(0));
      return r.ok;
    } catch {
      return false;
    }
  }
}
