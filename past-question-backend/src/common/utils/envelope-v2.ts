/**
 * Document envelope, format 2. Provider-agnostic: the data key is wrapped by a
 * DekWrapper (environment keyring or AWS KMS).
 *
 * Layout (big-endian):
 *   0  5  magic "TPDOC"
 *   5  1  format = 2
 *   6  1  provider id (1 env, 2 aws-kms)
 *   7  1  key version (env) or 0 (kms)
 *   8  2  wrapped-key length L
 *  10  L  wrapped data key
 *  10+L 12 data IV
 *  22+L 16 data tag
 *  38+L  N ciphertext (AES-256-GCM under the DEK)
 *
 * Data AAD = all bytes before the data tag. The wrap context = bytes 0..7
 * (magic, format, provider id).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { DekWrapper } from '../../storage/dek-wrapper.js';

export class EnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvelopeError';
  }
}

const MAGIC = Buffer.from('TPDOC', 'ascii');
const FIXED_PREFIX = 10;
const MAX_WRAPPED = 4096;

export async function encryptEnvelopeV2(plain: Buffer, wrapper: DekWrapper): Promise<Buffer> {
  const dek = randomBytes(32);
  const prefix = Buffer.alloc(8);
  MAGIC.copy(prefix, 0);
  prefix.writeUInt8(2, 5);
  prefix.writeUInt8(wrapper.providerId, 6);
  // Key version is written after wrapping; the wrap context excludes it so it
  // can be produced before the wrap call. See below.
  // Context = magic, format, provider: all known before wrapping. Excludes the
  // key-version byte, which is only known once the wrap call returns.
  const { wrapped, keyVersion } = await wrapper.wrap(dek, prefix.subarray(0, 7));
  if (wrapped.length > MAX_WRAPPED) throw new EnvelopeError('Wrapped key too large');

  const header = Buffer.alloc(FIXED_PREFIX + wrapped.length + 12);
  prefix.copy(header, 0);
  header.writeUInt8(keyVersion, 7);
  header.writeUInt16BE(wrapped.length, 8);
  wrapped.copy(header, FIXED_PREFIX);
  const iv = randomBytes(12);
  iv.copy(header, FIXED_PREFIX + wrapped.length);

  const c = createCipheriv('aes-256-gcm', dek, iv, { authTagLength: 16 });
  c.setAAD(header);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  dek.fill(0);
  return Buffer.concat([header, c.getAuthTag(), ct]);
}

export async function decryptEnvelopeV2(
  blob: Buffer,
  wrappers: Map<number, DekWrapper>,
): Promise<Buffer> {
  if (blob.length < FIXED_PREFIX + 12 + 16) throw new EnvelopeError('Stored object is truncated');
  if (!blob.subarray(0, 5).equals(MAGIC)) throw new EnvelopeError('Not an envelope object');
  if (blob.readUInt8(5) !== 2) throw new EnvelopeError('Unsupported envelope format');
  const providerId = blob.readUInt8(6);
  const keyVersion = blob.readUInt8(7);
  const wLen = blob.readUInt16BE(8);
  const hdrLen = FIXED_PREFIX + wLen + 12;
  if (wLen === 0 || wLen > MAX_WRAPPED || blob.length < hdrLen + 16)
    throw new EnvelopeError('Malformed envelope header');

  const wrapper = wrappers.get(providerId);
  if (!wrapper) throw new EnvelopeError(`Key provider ${providerId} is not configured`);

  const header = blob.subarray(0, hdrLen);
  const dek = await wrapper.unwrap(
    Buffer.from(header.subarray(FIXED_PREFIX, FIXED_PREFIX + wLen)),
    keyVersion,
    Buffer.from(header.subarray(0, 7)),
  );
  if (dek.length !== 32) throw new EnvelopeError('Unwrapped key has wrong length');

  const d = createDecipheriv('aes-256-gcm', dek, header.subarray(hdrLen - 12, hdrLen), { authTagLength: 16 });
  d.setAAD(header);
  d.setAuthTag(blob.subarray(hdrLen, hdrLen + 16));
  const plain = Buffer.concat([d.update(blob.subarray(hdrLen + 16)), d.final()]);
  dek.fill(0);
  return plain;
}
