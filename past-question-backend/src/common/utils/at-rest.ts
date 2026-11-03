/**
 * At-rest envelope encryption for stored original PDFs.
 *
 * Layout (big-endian, fixed offsets):
 *   0   5  magic            "TPDOC"
 *   5   1  format           1
 *   6   1  master key ver   u8, selects the master key in the keyring
 *   7  12  wrap IV
 *  19  32  wrapped DEK      AES-256-GCM(master key, random DEK)
 *  51  16  wrap tag
 *  67  12  data IV
 *  79  16  data tag
 *  95   N  ciphertext       AES-256-GCM(DEK, plaintext PDF)
 *
 * The data-encryption key (DEK) is random per object. Only the wrapped DEK is
 * stored. Master keys never leave the process configuration and are selected
 * by version, which supports rotation: new objects use the active version,
 * old objects remain readable while their version is still configured.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export class AtRestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtRestError';
  }
}

const MAGIC = Buffer.from('TPDOC', 'ascii');
const FORMAT = 1;
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = 95;
const OFF_WRAP_IV = 7;
const OFF_WRAPPED_DEK = 19;
const OFF_WRAP_TAG = 51;
const OFF_DATA_IV = 67;
const OFF_DATA_TAG = 79;

export interface MasterKeyring {
  activeVersion: number;
  keys: Map<number, Buffer>;
}

/**
 * Parses `"1:<base64-32-bytes>,2:<base64-32-bytes>"` and validates it.
 * Used both at boot (fail-fast) and by the production policy check.
 */
export function parseMasterKeyring(raw: string, activeVersion: number): MasterKeyring {
  if (!raw || !raw.trim()) throw new AtRestError('Document master keys are not configured');
  if (!Number.isInteger(activeVersion) || activeVersion < 1 || activeVersion > 255)
    throw new AtRestError('Active master key version must be an integer 1-255');
  const keys = new Map<number, Buffer>();
  for (const part of raw.split(',')) {
    const [v, b64] = part.split(':').map((x) => x.trim());
    const version = Number(v);
    if (!Number.isInteger(version) || version < 1 || version > 255 || !b64)
      throw new AtRestError('Malformed document master key entry');
    if (keys.has(version)) throw new AtRestError(`Duplicate master key version ${version}`);
    const key = Buffer.from(b64, 'base64');
    if (key.length !== KEY_LEN || key.toString('base64') !== b64)
      throw new AtRestError(`Master key version ${version} must be 32 bytes of base64`);
    keys.set(version, key);
  }
  if (!keys.has(activeVersion))
    throw new AtRestError('Active master key version is not present in the keyring');
  return { activeVersion, keys };
}

/** Development-only keyring derived from a fixed label. Never valid in production. */
export function developmentKeyring(): MasterKeyring {
  const key = createHash('sha256').update('development-document-master-key').digest();
  return { activeVersion: 1, keys: new Map([[1, key]]) };
}

export function encryptAtRest(plain: Buffer, ring: MasterKeyring): Buffer {
  const masterKey = ring.keys.get(ring.activeVersion);
  if (!masterKey) throw new AtRestError('Active master key missing');

  const dek = randomBytes(KEY_LEN);
  const header = Buffer.alloc(HEADER_LEN);
  MAGIC.copy(header, 0);
  header.writeUInt8(FORMAT, 5);
  header.writeUInt8(ring.activeVersion, 6);

  const wrapIv = randomBytes(IV_LEN);
  const wrap = createCipheriv('aes-256-gcm', masterKey, wrapIv, { authTagLength: TAG_LEN });
  wrap.setAAD(header.subarray(0, OFF_WRAP_IV));
  const wrappedDek = Buffer.concat([wrap.update(dek), wrap.final()]);
  wrapIv.copy(header, OFF_WRAP_IV);
  wrappedDek.copy(header, OFF_WRAPPED_DEK);
  wrap.getAuthTag().copy(header, OFF_WRAP_TAG);

  const dataIv = randomBytes(IV_LEN);
  dataIv.copy(header, OFF_DATA_IV);
  const data = createCipheriv('aes-256-gcm', dek, dataIv, { authTagLength: TAG_LEN });
  data.setAAD(header.subarray(0, OFF_DATA_TAG));
  const ciphertext = Buffer.concat([data.update(plain), data.final()]);
  data.getAuthTag().copy(header, OFF_DATA_TAG);

  dek.fill(0);
  return Buffer.concat([header, ciphertext]);
}

export function decryptAtRest(blob: Buffer, ring: MasterKeyring): Buffer {
  if (blob.length < HEADER_LEN) throw new AtRestError('Stored object is truncated');
  if (!blob.subarray(0, 5).equals(MAGIC))
    throw new AtRestError('Stored object is not in the encrypted at-rest format');
  if (blob.readUInt8(5) !== FORMAT) throw new AtRestError('Unsupported at-rest format');
  const version = blob.readUInt8(6);
  const masterKey = ring.keys.get(version);
  if (!masterKey) throw new AtRestError(`Master key version ${version} is not configured`);

  const header = blob.subarray(0, HEADER_LEN);
  const unwrap = createDecipheriv('aes-256-gcm', masterKey, header.subarray(OFF_WRAP_IV, OFF_WRAP_IV + IV_LEN), {
    authTagLength: TAG_LEN,
  });
  unwrap.setAAD(header.subarray(0, OFF_WRAP_IV));
  unwrap.setAuthTag(header.subarray(OFF_WRAP_TAG, OFF_WRAP_TAG + TAG_LEN));
  const dek = Buffer.concat([
    unwrap.update(header.subarray(OFF_WRAPPED_DEK, OFF_WRAPPED_DEK + KEY_LEN)),
    unwrap.final(),
  ]);

  const data = createDecipheriv('aes-256-gcm', dek, header.subarray(OFF_DATA_IV, OFF_DATA_IV + IV_LEN), {
    authTagLength: TAG_LEN,
  });
  data.setAAD(header.subarray(0, OFF_DATA_TAG));
  data.setAuthTag(header.subarray(OFF_DATA_TAG, OFF_DATA_TAG + TAG_LEN));
  const plain = Buffer.concat([data.update(blob.subarray(HEADER_LEN)), data.final()]);
  dek.fill(0);
  return plain;
}

export function keyVersionOf(blob: Buffer): number {
  return blob.readUInt8(6);
}
