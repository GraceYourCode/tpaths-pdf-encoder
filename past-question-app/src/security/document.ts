import {
  Buffer,
  createDecipheriv,
  createECDH,
  createHash,
  createHmac,
} from 'react-native-quick-crypto';

const HEADER = 245;
const MAX_CIPHERTEXT = 256 * 1024 * 1024;
const MAGIC = Buffer.from('TPQE', 'ascii');
const INFO_LABEL = Buffer.from('TPATHS-PQE/v1/dek-wrap', 'ascii');
const SPKI_PREFIX = Buffer.from(
  '3059301306072a8648ce3d020106082a8648ce3d030107034200',
  'hex',
);

function uuidBytes(value: string): Buffer {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Device identifier is invalid.');
  }
  return Buffer.from(value.replace(/-/g, ''), 'hex');
}
function bytesUuid(b: Buffer): string {
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function hkdfSha256(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  const prk = createHmac('sha256', salt).update(ikm).digest();
  let previous = Buffer.alloc(0);
  const blocks: Buffer[] = [];
  for (let i = 1; Buffer.concat(blocks).length < length; i += 1) {
    previous = createHmac('sha256', prk)
      .update(Buffer.concat([previous, info, Buffer.from([i])]))
      .digest();
    blocks.push(previous);
  }
  const output = Buffer.concat(blocks).subarray(0, length);
  prk.fill(0);
  previous.fill(0);
  return output;
}
function decryptGcm(key: Buffer, iv: Buffer, aad: Buffer, ciphertext: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Strict TPQE v1 parser + authenticated decryptor. Plaintext is returned only after both GCM tags verify. */
export async function decryptArtifact(
  artifact: Uint8Array,
  privateKeyHex: string,
  publicKeyBase64: string,
  expectedDeviceId: string,
  checksum?: string | null,
  expectedDocumentId?: string,
): Promise<Uint8Array> {
  const input = Buffer.from(artifact);
  if (input.length < HEADER) throw new Error('Protected document is truncated.');
  if (input.length > HEADER + MAX_CIPHERTEXT) throw new Error('Protected document exceeds the supported size.');
  if (!input.subarray(0, 4).equals(MAGIC)) throw new Error('Protected document format is unsupported.');
  if (input[4] !== 1) throw new Error('Unsupported protected document version.');
  if (input[5] !== 1) throw new Error('Unsupported protected document cryptographic suite.');
  if (input.readUInt16BE(6) !== 0) throw new Error('Protected document header is invalid.');
  const cipherLength = input.readUInt32BE(225);
  if (cipherLength === 0 || cipherLength > MAX_CIPHERTEXT || cipherLength !== input.length - HEADER) {
    throw new Error('Protected document length is invalid.');
  }
  if (input[56] !== 4) throw new Error('Protected document ephemeral key is invalid.');

  const artifactDeviceId = bytesUuid(input.subarray(40, 56));
  if (artifactDeviceId !== expectedDeviceId.toLowerCase()) {
    throw new Error('This document was encrypted for a different device.');
  }
  if (expectedDocumentId && bytesUuid(input.subarray(24, 40)) !== expectedDocumentId.toLowerCase()) {
    throw new Error('The protected document identifier does not match the requested document.');
  }
  const publicDer = Buffer.from(publicKeyBase64, 'base64');
  if (publicDer.length !== 91 || !publicDer.subarray(0, SPKI_PREFIX.length).equals(SPKI_PREFIX)) {
    throw new Error('Stored device public key is invalid.');
  }
  const publicPoint = publicDer.subarray(SPKI_PREFIX.length);
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(privateKeyHex, 'hex'));
  const derivedPublic = ecdh.getPublicKey(undefined, 'uncompressed');
  if (!derivedPublic.equals(publicPoint)) throw new Error('Stored device key pair does not match.');

  const ephemeralPoint = input.subarray(56, 121);
  const shared = ecdh.computeSecret(ephemeralPoint);
  const deviceIdBytes = uuidBytes(expectedDeviceId);
  const publicKeyHash = createHash('sha256').update(publicDer).digest();
  const info = Buffer.concat([INFO_LABEL, deviceIdBytes, publicKeyHash]);
  const wrapKey = hkdfSha256(shared, input.subarray(121, 153), info, 32);

  let dek: Buffer | undefined;
  try {
    dek = decryptGcm(
      wrapKey,
      input.subarray(153, 165),
      input.subarray(0, 153),
      input.subarray(165, 197),
      input.subarray(197, 213),
    );
    if (dek.length !== 32) throw new Error('Document key has an invalid length.');
    const plaintext = decryptGcm(
      dek,
      input.subarray(213, 225),
      input.subarray(0, 229),
      input.subarray(245),
      input.subarray(229, 245),
    );
    // The backend access response exposes checksumSha256 for the original PDF.
    if (checksum) {
      const actual = createHash('sha256').update(plaintext).digest('hex');
      if (actual.toLowerCase() !== checksum.replace(/^sha256:/i, '').toLowerCase()) {
        plaintext.fill(0);
        throw new Error('Decrypted PDF checksum does not match the backend record.');
      }
    }
    return new Uint8Array(plaintext);
  } catch {
    throw new Error('Document authentication failed. The file may be damaged or not intended for this device.');
  } finally {
    shared.fill(0);
    wrapKey.fill(0);
    dek?.fill(0);
  }
}
