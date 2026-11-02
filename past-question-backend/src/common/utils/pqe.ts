/**
 * TPQE v1 — device-bound PDF artifact protocol.
 *
 * See docs/pqe-artifact-protocol.md for the normative specification.
 *
 * Key agreement: ephemeral-static ECDH on NIST P-256.
 * Key derivation: HKDF-SHA256 (random 32-byte salt, context-specific info).
 * Symmetric: AES-256-GCM for the wrapped document key and for the PDF.
 *
 * This module is intentionally dependency-free (node:crypto only).
 */
import {
  createHash,
  createPublicKey,
  createCipheriv,
  createDecipheriv,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';

export class PqeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PqeError';
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PQE_MAGIC = Buffer.from('TPQE', 'ascii');
export const PQE_VERSION = 1;
/** Suite 1 = P-256 ECDH / HKDF-SHA256 / AES-256-GCM. */
export const PQE_SUITE_P256_HKDF_SHA256_AES256GCM = 1;

const HKDF_INFO_LABEL = Buffer.from('TPATHS-PQE/v1/dek-wrap', 'ascii');
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT_LEN = 32;
const UUID_LEN = 16;
/** Uncompressed SEC1 point: 0x04 || X(32) || Y(32). */
const POINT_LEN = 65;
/** Hard upper bound on protected PDF size (256 MiB). */
export const PQE_MAX_PDF_BYTES = 256 * 1024 * 1024;

/**
 * Fixed DER prefix of a P-256 SubjectPublicKeyInfo.
 * A valid device key must be exactly this prefix followed by a 65-byte point.
 * Enforcing the prefix guarantees: EC key, prime256v1 curve, uncompressed point.
 */
const P256_SPKI_PREFIX = Buffer.from(
  '3059301306072a8648ce3d020106082a8648ce3d030107034200',
  'hex',
);
const P256_SPKI_LEN = P256_SPKI_PREFIX.length + POINT_LEN; // 91

// ---------------------------------------------------------------------------
// Header layout (all offsets in bytes, big-endian integers)
// ---------------------------------------------------------------------------

const OFF_MAGIC = 0; // 4
const OFF_VERSION = 4; // 1
const OFF_SUITE = 5; // 1
const OFF_RESERVED = 6; // 2, must be zero
const OFF_ARTIFACT_ID = 8; // 16
const OFF_DOCUMENT_ID = 24; // 16
const OFF_DEVICE_ID = 40; // 16
const OFF_EPHEMERAL_PUB = 56; // 65
const OFF_HKDF_SALT = 121; // 32
/** End of the wrap AAD region (everything before the wrap IV). */
const OFF_WRAP_IV = 153; // 12
const OFF_WRAPPED_DEK = 165; // 32
const OFF_WRAP_TAG = 197; // 16
const OFF_PDF_IV = 213; // 12
const OFF_CIPHERTEXT_LEN = 225; // 4
/** Everything before the PDF tag is authenticated as PDF AAD. */
const OFF_PDF_TAG = 229; // 16
export const PQE_HEADER_LEN = 245;

// ---------------------------------------------------------------------------
// Public-key helpers
// ---------------------------------------------------------------------------

export interface ParsedP256PublicKey {
  keyObject: KeyObject;
  /** 65-byte uncompressed point. */
  point: Buffer;
  /** Canonical 91-byte SPKI DER. */
  der: Buffer;
}

/**
 * Strictly parses a device public key given as DER SubjectPublicKeyInfo.
 * Rejects anything that is not a P-256 uncompressed key that is on the curve.
 */
export function parseP256PublicKeyDer(der: Buffer): ParsedP256PublicKey {
  if (der.length !== P256_SPKI_LEN) {
    throw new PqeError('Device public key has an unsupported encoding length');
  }
  if (!der.subarray(0, P256_SPKI_PREFIX.length).equals(P256_SPKI_PREFIX)) {
    throw new PqeError('Device public key must be an EC P-256 SPKI key');
  }
  let keyObject: KeyObject;
  try {
    keyObject = createPublicKey({ key: der, format: 'der', type: 'spki' });
  } catch {
    throw new PqeError('Device public key could not be parsed');
  }
  // createPublicKey validates that the point lies on the curve.
  if (keyObject.asymmetricKeyType !== 'ec') {
    throw new PqeError('Device public key must be an EC key');
  }
  return {
    keyObject,
    point: Buffer.from(der.subarray(P256_SPKI_PREFIX.length)),
    der: Buffer.from(der),
  };
}

/**
 * Validates a base64-encoded DER SPKI device public key received from a client.
 * Returns the canonical DER bytes.
 */
export function decodeDevicePublicKeyBase64(b64: string): Buffer {
  if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new PqeError('Device public key must be base64-encoded DER');
  }
  const der = Buffer.from(b64, 'base64');
  return parseP256PublicKeyDer(der).der;
}

/** SHA-256 fingerprint (hex) of canonical SPKI DER. Used for audit and binding. */
export function publicKeyFingerprint(der: Buffer): string {
  return createHash('sha256').update(der).digest('hex');
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function uuidToBytes(uuid: string): Buffer {
  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      uuid,
    )
  ) {
    throw new PqeError('Identifier must be a UUID');
  }
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bytesToUuid(b: Buffer): string {
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function wrapInfo(deviceIdBytes: Buffer, devicePubDer: Buffer): Buffer {
  return Buffer.concat([
    HKDF_INFO_LABEL,
    deviceIdBytes,
    createHash('sha256').update(devicePubDer).digest(),
  ]);
}

function deriveWrapKey(
  sharedSecret: Buffer,
  salt: Buffer,
  deviceIdBytes: Buffer,
  devicePubDer: Buffer,
): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      sharedSecret,
      salt,
      wrapInfo(deviceIdBytes, devicePubDer),
      KEY_LEN,
    ),
  );
}

function wipe(...buffers: Buffer[]): void {
  for (const b of buffers) b.fill(0);
}

// ---------------------------------------------------------------------------
// Encoding (backend)
// ---------------------------------------------------------------------------

export interface EncodeArtifactInput {
  pdf: Buffer;
  artifactId: string;
  documentId: string;
  /** Backend-issued device identifier (UUID). */
  deviceId: string;
  /** Registered device public key, canonical SPKI DER. */
  devicePublicKeyDer: Buffer;
}

export function encodePqeArtifact(input: EncodeArtifactInput): Buffer {
  const { pdf } = input;
  if (pdf.length === 0) throw new PqeError('PDF is empty');
  if (pdf.length > PQE_MAX_PDF_BYTES) {
    throw new PqeError('PDF exceeds the maximum artifact size');
  }

  const device = parseP256PublicKeyDer(input.devicePublicKeyDer);
  const deviceIdBytes = uuidToBytes(input.deviceId);

  // Ephemeral P-256 key pair, one per artifact.
  const ephemeral = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const ephemeralDer = Buffer.from(
    ephemeral.publicKey.export({ format: 'der', type: 'spki' }),
  );
  const ephemeralPoint = ephemeralDer.subarray(P256_SPKI_PREFIX.length);

  const salt = randomBytes(SALT_LEN);
  const sharedSecret = diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: device.keyObject,
  });
  const wrapKey = deriveWrapKey(sharedSecret, salt, deviceIdBytes, device.der);

  // Fixed-layout header, filled progressively.
  const header = Buffer.alloc(PQE_HEADER_LEN);
  PQE_MAGIC.copy(header, OFF_MAGIC);
  header.writeUInt8(PQE_VERSION, OFF_VERSION);
  header.writeUInt8(PQE_SUITE_P256_HKDF_SHA256_AES256GCM, OFF_SUITE);
  // reserved bytes stay zero
  uuidToBytes(input.artifactId).copy(header, OFF_ARTIFACT_ID);
  uuidToBytes(input.documentId).copy(header, OFF_DOCUMENT_ID);
  deviceIdBytes.copy(header, OFF_DEVICE_ID);
  ephemeralPoint.copy(header, OFF_EPHEMERAL_PUB);
  salt.copy(header, OFF_HKDF_SALT);

  // Wrap the random document key (DEK) under the derived wrapping key.
  const dek = randomBytes(KEY_LEN);
  const wrapIv = randomBytes(IV_LEN);
  const wrapCipher = createCipheriv('aes-256-gcm', wrapKey, wrapIv, {
    authTagLength: TAG_LEN,
  });
  wrapCipher.setAAD(header.subarray(0, OFF_WRAP_IV));
  const wrappedDek = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();
  wrapIv.copy(header, OFF_WRAP_IV);
  wrappedDek.copy(header, OFF_WRAPPED_DEK);
  wrapTag.copy(header, OFF_WRAP_TAG);

  // Encrypt the PDF under the DEK. AAD = header up to (not incl.) PDF tag,
  // which covers the wrapped key, its tag, the PDF IV and the length.
  const pdfIv = randomBytes(IV_LEN);
  pdfIv.copy(header, OFF_PDF_IV);
  header.writeUInt32BE(pdf.length, OFF_CIPHERTEXT_LEN);
  const pdfCipher = createCipheriv('aes-256-gcm', dek, pdfIv, {
    authTagLength: TAG_LEN,
  });
  pdfCipher.setAAD(header.subarray(0, OFF_PDF_TAG));
  const ciphertext = Buffer.concat([pdfCipher.update(pdf), pdfCipher.final()]);
  pdfCipher.getAuthTag().copy(header, OFF_PDF_TAG);

  wipe(dek, wrapKey, sharedSecret);
  return Buffer.concat([header, ciphertext]);
}

// ---------------------------------------------------------------------------
// Parsing (strict, shared)
// ---------------------------------------------------------------------------

export interface ParsedPqeArtifact {
  version: number;
  suite: number;
  artifactId: string;
  documentId: string;
  deviceId: string;
  ephemeralPoint: Buffer;
  hkdfSalt: Buffer;
  wrapIv: Buffer;
  wrappedDek: Buffer;
  wrapTag: Buffer;
  pdfIv: Buffer;
  pdfTag: Buffer;
  ciphertext: Buffer;
  /** Raw header bytes, used as AAD. */
  header: Buffer;
}

/** Strictly parses a TPQE v1 artifact. Throws on any malformation. */
export function parsePqeArtifact(
  buf: Buffer,
  maxBytes = PQE_HEADER_LEN + PQE_MAX_PDF_BYTES,
): ParsedPqeArtifact {
  if (buf.length < PQE_HEADER_LEN) throw new PqeError('Artifact is truncated');
  if (buf.length > maxBytes) throw new PqeError('Artifact exceeds maximum size');
  if (!buf.subarray(OFF_MAGIC, OFF_MAGIC + 4).equals(PQE_MAGIC)) {
    throw new PqeError('Artifact magic is invalid');
  }
  const version = buf.readUInt8(OFF_VERSION);
  if (version !== PQE_VERSION) {
    throw new PqeError(`Unsupported artifact version ${version}`);
  }
  const suite = buf.readUInt8(OFF_SUITE);
  if (suite !== PQE_SUITE_P256_HKDF_SHA256_AES256GCM) {
    throw new PqeError(`Unsupported cryptographic suite ${suite}`);
  }
  if (buf.readUInt16BE(OFF_RESERVED) !== 0) {
    throw new PqeError('Reserved header bytes must be zero');
  }
  const ciphertextLen = buf.readUInt32BE(OFF_CIPHERTEXT_LEN);
  if (ciphertextLen !== buf.length - PQE_HEADER_LEN) {
    throw new PqeError('Ciphertext length does not match artifact size');
  }
  if (ciphertextLen === 0 || ciphertextLen > PQE_MAX_PDF_BYTES) {
    throw new PqeError('Ciphertext length is out of range');
  }
  const ephemeralPoint = buf.subarray(OFF_EPHEMERAL_PUB, OFF_EPHEMERAL_PUB + POINT_LEN);
  if (ephemeralPoint[0] !== 0x04) {
    throw new PqeError('Ephemeral key must be an uncompressed point');
  }
  return {
    version,
    suite,
    artifactId: bytesToUuid(buf.subarray(OFF_ARTIFACT_ID, OFF_ARTIFACT_ID + UUID_LEN)),
    documentId: bytesToUuid(buf.subarray(OFF_DOCUMENT_ID, OFF_DOCUMENT_ID + UUID_LEN)),
    deviceId: bytesToUuid(buf.subarray(OFF_DEVICE_ID, OFF_DEVICE_ID + UUID_LEN)),
    ephemeralPoint: Buffer.from(ephemeralPoint),
    hkdfSalt: Buffer.from(buf.subarray(OFF_HKDF_SALT, OFF_HKDF_SALT + SALT_LEN)),
    wrapIv: Buffer.from(buf.subarray(OFF_WRAP_IV, OFF_WRAP_IV + IV_LEN)),
    wrappedDek: Buffer.from(buf.subarray(OFF_WRAPPED_DEK, OFF_WRAPPED_DEK + KEY_LEN)),
    wrapTag: Buffer.from(buf.subarray(OFF_WRAP_TAG, OFF_WRAP_TAG + TAG_LEN)),
    pdfIv: Buffer.from(buf.subarray(OFF_PDF_IV, OFF_PDF_IV + IV_LEN)),
    pdfTag: Buffer.from(buf.subarray(OFF_PDF_TAG, OFF_PDF_TAG + TAG_LEN)),
    ciphertext: Buffer.from(buf.subarray(PQE_HEADER_LEN)),
    header: Buffer.from(buf.subarray(0, PQE_HEADER_LEN)),
  };
}

// ---------------------------------------------------------------------------
// Decryption (reference implementation of the device side)
// ---------------------------------------------------------------------------

/**
 * Reference device-side decryption. The production mobile client must perform
 * the same steps, with the static private key kept inside the platform keystore.
 *
 * Any authentication failure throws; no plaintext is returned unless both the
 * wrapped key and the PDF authenticate successfully.
 */
export function decodePqeArtifact(
  buf: Buffer,
  devicePrivateKey: KeyObject,
  devicePublicKeyDer: Buffer,
): Buffer {
  const device = parseP256PublicKeyDer(devicePublicKeyDer);
  const parsed = parsePqeArtifact(buf);
  const deviceIdBytes = uuidToBytes(parsed.deviceId);

  const ephemeral = parseP256PublicKeyDer(
    Buffer.concat([P256_SPKI_PREFIX, parsed.ephemeralPoint]),
  );
  const sharedSecret = diffieHellman({
    privateKey: devicePrivateKey,
    publicKey: ephemeral.keyObject,
  });
  const wrapKey = deriveWrapKey(sharedSecret, parsed.hkdfSalt, deviceIdBytes, device.der);

  const unwrap = createDecipheriv('aes-256-gcm', wrapKey, parsed.wrapIv, {
    authTagLength: TAG_LEN,
  });
  unwrap.setAAD(parsed.header.subarray(0, OFF_WRAP_IV));
  unwrap.setAuthTag(parsed.wrapTag);
  const dek = Buffer.concat([unwrap.update(parsed.wrappedDek), unwrap.final()]);

  const pdfDecipher = createDecipheriv('aes-256-gcm', dek, parsed.pdfIv, {
    authTagLength: TAG_LEN,
  });
  pdfDecipher.setAAD(parsed.header.subarray(0, OFF_PDF_TAG));
  pdfDecipher.setAuthTag(parsed.pdfTag);
  const pdf = Buffer.concat([pdfDecipher.update(parsed.ciphertext), pdfDecipher.final()]);

  wipe(dek, wrapKey, sharedSecret);
  return pdf;
}
